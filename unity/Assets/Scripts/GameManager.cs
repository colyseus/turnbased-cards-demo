using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Colyseus;
using Colyseus.Schema;

/// <summary>
/// Main game controller for the UNO card game.
/// Manages card entities, layout, interactions, and all game state visualization.
/// </summary>
public class GameManager : MonoBehaviour
{
    // ── Constants ───────────────────────────────────────────────────

    private const float CARD_ASPECT = 240f / 375f;
    private const float SHOWCASE_DURATION = 0.7f;

    private static readonly Dictionary<string, Color> COLOR_HEX = new()
    {
        { "red",    new Color(1f, 0.2f, 0.2f) },      // #ff3333
        { "blue",   new Color(0.2f, 0.467f, 1f) },     // #3377ff
        { "green",  new Color(0.2f, 0.733f, 0.267f) }, // #33bb44
        { "yellow", new Color(1f, 0.8f, 0f) },         // #ffcc00
    };

    private static readonly Color FELT_COLOR = new Color(0.102f, 0.478f, 0.235f); // #1a7a3c

    // Player angles for turn indicator: 0=bottom(-PI/2), 1=left(PI), 2=top(PI/2), 3=right(0)
    private static readonly float[] PLAYER_ANGLE = { -Mathf.PI / 2f, Mathf.PI, Mathf.PI / 2f, 0f };

    // ── Card texture cache ──────────────────────────────────────────

    private Dictionary<string, Texture2D> cardTextures = new();

    // ── Card entities ───────────────────────────────────────────────

    private Dictionary<string, CardEntity> cardEntities = new();

    // ── Game state tracking ─────────────────────────────────────────

    private int localSeatIndex = 0;
    private int prevDiscardLen = 0;
    private int prevCurrentPlayer = -1;
    private Dictionary<int, int> prevHandCounts = new();
    private HashSet<string> prevLocalHandIds = new();

    // ── Interaction state ───────────────────────────────────────────

    private string hoveredCardId = null;
    private string showcaseCardId = null;
    private float showcaseTimer = 0f;
    private string colorPickerForCardId = null;
    private string hoveredPickerColor = null;
    private HashSet<string> playableSet = new();

    // ── Auto-draw ───────────────────────────────────────────────────

    private float autoDrawTimer = -1f;
    private bool autoDrawPending = false;

    // ── Scene objects ───────────────────────────────────────────────

    private Camera cam;
    private GameObject tablePlane;
    private GameObject activeColorRingOuter;
    private GameObject activeColorRingInner;
    private GameObject activeColorRingGroup;
    private float ringVelScale, ringVelInner;
    private float ringTargetScale = 1f, ringTargetInner = 1f;
    private string prevActiveColor = "";

    // ── Turn indicator ──────────────────────────────────────────────

    private GameObject turnArrowGroup;
    private GameObject turnArrowMesh;
    private GameObject dirArrowGroup;
    private float turnArrowCurrentAngle;
    private float turnArrowTargetAngle;
    private float turnArrowVel;
    private int turnArrowPrevPlayer = -1;

    // ── Color picker ────────────────────────────────────────────────

    private GameObject colorPickerOverlay;
    private Material colorPickerOverlayMat;
    private float colorPickerOverlayVel;
    private GameObject[] colorPickerCircles = new GameObject[4];
    private float[] colorPickerCircleVels = new float[4];
    private float colorPickerElapsed;
    private static readonly string[] PICKER_COLORS = { "red", "yellow", "green", "blue" };
    private const float PICKER_STAGGER = 0.08f;

    // ── Winner overlay (3D) ─────────────────────────────────────────

    private GameObject winnerOverlay3D;

    // ── Layout cache ────────────────────────────────────────────────

    private LayoutParams L;

    private struct LayoutParams
    {
        public float playerScale, playerSpacing, playerHoverScale, hoverLift, bottomY;
        public float opponentScale, hSpacing, vSpacing, topY, sideX, sideYOffset;
        public float pileX, pileScale, discardScale;
        public float showcaseScale;
        public float turnRadius;
    }

    // ── References ──────────────────────────────────────────────────

    private NetworkManager net;
    private HUDManager hud;

    // ================================================================
    // Lifecycle
    // ================================================================

    void Start()
    {
        net = NetworkManager.Instance;
        hud = FindObjectOfType<HUDManager>();

        LoadCardTextures();
        SetupScene();

        net.OnStateChanged += OnStateChanged;

        // Force initial layout and state
        RecalculateLayout();
        OnStateChanged();
    }

    void OnDestroy()
    {
        if (net != null)
            net.OnStateChanged -= OnStateChanged;

        foreach (var kvp in cardEntities)
            kvp.Value.Destroy();
        cardEntities.Clear();
    }

    // ================================================================
    // Texture Loading
    // ================================================================

    void LoadCardTextures()
    {
        string[] colors = { "red", "blue", "green", "yellow" };
        string[] values = { "0","1","2","3","4","5","6","7","8","9","skip","reverse","draw2" };

        foreach (var c in colors)
        {
            foreach (var v in values)
            {
                string id = $"{c}_{v}";
                var tex = Resources.Load<Texture2D>($"Cards/{id}");
                if (tex != null)
                {
                    tex.filterMode = FilterMode.Bilinear;
                    cardTextures[id] = tex;
                }
            }
        }

        // Wilds
        foreach (var w in new[] { "wild", "wild_draw4" })
        {
            var tex = Resources.Load<Texture2D>($"Cards/{w}");
            if (tex != null)
            {
                tex.filterMode = FilterMode.Bilinear;
                cardTextures[w] = tex;
            }
        }

        // Back
        var back = Resources.Load<Texture2D>("Cards/back");
        if (back != null)
        {
            back.filterMode = FilterMode.Bilinear;
            cardTextures["back"] = back;
        }
    }

    Texture2D GetTexture(string textureId)
    {
        if (cardTextures.TryGetValue(textureId, out var tex))
            return tex;
        return cardTextures.GetValueOrDefault("back");
    }

    static string CardTextureFromSchema(UnoCardSchema card)
    {
        if (card.cardType == "wild") return card.value;
        return $"{card.color}_{card.value}";
    }

    // ================================================================
    // Scene Setup
    // ================================================================

    void SetupScene()
    {
        // Camera
        cam = Camera.main;
        cam.transform.position = new Vector3(0, -0.5f, 10f);
        cam.transform.LookAt(new Vector3(0, -0.5f, 0));
        cam.fieldOfView = 50f;
        cam.backgroundColor = new Color(0.08f, 0.353f, 0.125f); // #145a20

        // Lighting
        RenderSettings.ambientLight = Color.white * 2.5f;
        RenderSettings.ambientIntensity = 2.5f;

        var sunGO = new GameObject("DirectionalLight");
        var sun = sunGO.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.intensity = 1.5f;
        sunGO.transform.position = new Vector3(0, 2, 10);
        sunGO.transform.LookAt(Vector3.zero);

        // Table (large plane at z = -0.5)
        tablePlane = GameObject.CreatePrimitive(PrimitiveType.Quad);
        tablePlane.name = "Table";
        tablePlane.transform.position = new Vector3(0, 0, -0.5f);
        tablePlane.transform.localScale = new Vector3(25f, 16f, 1f);
        Object.Destroy(tablePlane.GetComponent<Collider>());

        var feltTex = CreateFeltTexture();
        var tableMat = new Material(Shader.Find("Unlit/Texture"));
        tableMat.mainTexture = feltTex;
        tableMat.mainTextureScale = new Vector2(6, 4); // Repeat 6x4
        tablePlane.GetComponent<Renderer>().material = tableMat;

        // Active color ring (will be positioned in layout)
        SetupActiveColorRing();

        // Turn indicator
        SetupTurnIndicator();

        // Color picker (hidden initially)
        SetupColorPicker();

        // Winner 3D overlay (hidden initially)
        winnerOverlay3D = CreateOverlayPlane("WinnerOverlay3D", new Vector3(0, 0, 3f), 0.5f);
        winnerOverlay3D.SetActive(false);
    }

    Texture2D CreateFeltTexture()
    {
        int size = 512;
        var tex = new Texture2D(size, size, TextureFormat.RGB24, false);

        Color baseColor = FELT_COLOR;
        var pixels = new Color[size * size];

        for (int i = 0; i < pixels.Length; i++)
        {
            float noise = (Random.value - 0.5f) * 0.07f; // +-9/255 approx
            pixels[i] = new Color(
                Mathf.Clamp01(baseColor.r + noise),
                Mathf.Clamp01(baseColor.g + noise),
                Mathf.Clamp01(baseColor.b + noise)
            );
        }
        tex.SetPixels(pixels);

        // Draw directional strokes
        Color strokeColor = new Color(1, 1, 1, 0.02f);
        for (int s = 0; s < 200; s++)
        {
            float x = Random.value * size;
            float y = Random.value * size;
            float len = 4 + Random.value * 12;
            float angle = Mathf.PI * 0.25f + (Random.value - 0.5f) * 0.5f;
            float dx = Mathf.Cos(angle);
            float dy = Mathf.Sin(angle);
            for (float t = 0; t < len; t += 0.5f)
            {
                int px = Mathf.Clamp((int)(x + dx * t), 0, size - 1);
                int py = Mathf.Clamp((int)(y + dy * t), 0, size - 1);
                Color existing = pixels[py * size + px];
                pixels[py * size + px] = Color.Lerp(existing, Color.white, 0.02f);
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();

        tex.wrapMode = TextureWrapMode.Repeat;
        tex.filterMode = FilterMode.Bilinear;

        // We need tiling. Since we use Unlit/Texture, set tiling on the material instead.
        return tex;
    }

    void SetupActiveColorRing()
    {
        activeColorRingGroup = new GameObject("ActiveColorRing");

        activeColorRingOuter = CreateCircle("RingOuter", 32, Color.red);
        activeColorRingOuter.transform.SetParent(activeColorRingGroup.transform, false);

        activeColorRingInner = CreateCircle("RingInner", 32, FELT_COLOR);
        activeColorRingInner.transform.SetParent(activeColorRingGroup.transform, false);
        activeColorRingInner.transform.localPosition = new Vector3(0, 0, 0.001f);

        activeColorRingGroup.SetActive(false);
    }

    void SetupTurnIndicator()
    {
        turnArrowGroup = new GameObject("TurnArrow");
        turnArrowGroup.transform.position = new Vector3(0, 0, 0.1f);

        // Main arrow
        turnArrowMesh = CreateTriangle("Arrow", 0.3f, new Color(1, 1, 1, 0.8f));
        turnArrowMesh.transform.SetParent(turnArrowGroup.transform, false);

        // Direction arrows group
        dirArrowGroup = new GameObject("DirArrows");
        dirArrowGroup.transform.SetParent(turnArrowGroup.transform, false);

        turnArrowGroup.SetActive(false);
    }

    void SetupColorPicker()
    {
        colorPickerOverlay = CreateOverlayPlane("ColorPickerOverlay", new Vector3(0, 0, 1.9f), 0f);
        colorPickerOverlayMat = colorPickerOverlay.GetComponent<Renderer>().material;
        colorPickerOverlay.SetActive(false);

        for (int i = 0; i < 4; i++)
        {
            string colorName = PICKER_COLORS[i];
            colorPickerCircles[i] = CreateCircle($"Picker_{colorName}", 32,
                COLOR_HEX.GetValueOrDefault(colorName, Color.white));
            colorPickerCircles[i].transform.localScale = Vector3.zero;

            float angle = (i / 4f) * Mathf.PI * 2f - Mathf.PI / 4f;
            float r = 0.6f;
            colorPickerCircles[i].transform.position = new Vector3(
                Mathf.Cos(angle) * r,
                Mathf.Sin(angle) * r,
                2f
            );

            // Add a collider for raycasting
            var col = colorPickerCircles[i].AddComponent<SphereCollider>();
            col.radius = 0.35f;
            colorPickerCircles[i].SetActive(false);
        }
    }

    // ================================================================
    // Layout Calculation
    // ================================================================

    void RecalculateLayout()
    {
        float vw = cam.orthographicSize * 2f * cam.aspect;
        float vh = cam.orthographicSize * 2f;

        // For perspective camera, approximate viewport dimensions at z=0
        if (!cam.orthographic)
        {
            float dist = cam.transform.position.z;
            vh = 2f * dist * Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad);
            vw = vh * cam.aspect;
        }

        bool portrait = vw < vh;
        float unit = Mathf.Min(vw, vh);

        L.playerScale = portrait ? vw * 0.25f : unit * 0.21f;
        L.playerSpacing = L.playerScale * (portrait ? 0.28f : 0.36f);
        L.playerHoverScale = L.playerScale * 1.12f;
        L.hoverLift = L.playerScale * 0.3f;
        L.bottomY = -vh * 0.39f;

        L.opponentScale = portrait ? vw * 0.13f : unit * 0.11f;
        L.hSpacing = L.opponentScale * 0.35f;
        L.vSpacing = L.opponentScale * 0.35f;
        L.topY = vh * 0.35f;
        L.sideX = Mathf.Clamp(vw * 0.42f, unit * 0.3f, 5.5f);
        L.sideYOffset = -vh * 0.03f;

        L.pileX = Mathf.Clamp(unit * 0.12f, 0.4f, 1.2f);
        L.pileScale = portrait ? vw * 0.14f : unit * 0.11f;
        L.discardScale = portrait ? vw * 0.16f : unit * 0.13f;

        L.showcaseScale = portrait ? vw * 0.4f : unit * 0.3f;

        L.turnRadius = Mathf.Min(vh * 0.28f, vw * 0.32f);
    }

    // ================================================================
    // State Change Handler
    // ================================================================

    void OnStateChanged()
    {
        if (net?.State == null) return;
        var state = net.State;

        RecalculateLayout();
        UpdateLocalSeatIndex();
        UpdatePlayableSet();
        UpdateAutoDrawLogic();
    }

    void UpdateLocalSeatIndex()
    {
        var state = net.State;
        if (state?.players == null || net.SessionId == null) return;

        state.players.ForEach((key, player) =>
        {
            if (player.sessionId == net.SessionId)
                localSeatIndex = player.seatIndex;
        });
    }

    // ================================================================
    // Playable Cards
    // ================================================================

    void UpdatePlayableSet()
    {
        playableSet.Clear();

        var state = net.State;
        if (state == null || showcaseCardId != null || colorPickerForCardId != null ||
            state.currentPlayer != localSeatIndex ||
            state.winner != -1 || state.pendingDraw > 0)
            return;

        if (state.discardPile == null || state.discardPile.Count == 0)
            return;

        var topCard = state.discardPile[state.discardPile.Count - 1];
        var localHand = GetLocalHand();

        foreach (var card in localHand)
        {
            if (CanPlayCard(card, topCard, state.activeColor))
                playableSet.Add(card.id);
        }
    }

    static bool CanPlayCard(UnoCardSchema card, UnoCardSchema topCard, string activeColor)
    {
        if (card.cardType == "wild") return true;
        if (card.color == activeColor) return true;
        if (topCard.cardType == "color" && card.value == topCard.value) return true;
        return false;
    }

    // ================================================================
    // Auto-Draw Logic
    // ================================================================

    void UpdateAutoDrawLogic()
    {
        var state = net.State;
        if (state == null || net.SessionId == null) return;

        bool shouldAutoDraw = false;

        if (state.currentPlayer == localSeatIndex && state.winner == -1 &&
            showcaseCardId == null && colorPickerForCardId == null)
        {
            if (state.pendingDraw > 0)
            {
                shouldAutoDraw = true;
            }
            else if (playableSet.Count == 0 && GetLocalHand().Count > 0)
            {
                shouldAutoDraw = true;
            }
        }

        if (shouldAutoDraw && !autoDrawPending)
        {
            autoDrawPending = true;
            autoDrawTimer = 0.8f;
        }
        else if (!shouldAutoDraw)
        {
            autoDrawPending = false;
            autoDrawTimer = -1f;
        }
    }

    // ================================================================
    // Helpers
    // ================================================================

    int GetVisualPosition(int seatIndex)
    {
        return ((seatIndex - localSeatIndex) + 4) % 4;
    }

    List<UnoCardSchema> GetLocalHand()
    {
        var result = new List<UnoCardSchema>();
        var state = net.State;
        if (state?.players == null) return result;

        state.players.ForEach((key, player) =>
        {
            if (player.seatIndex == localSeatIndex && player.hand != null)
            {
                for (int i = 0; i < player.hand.Count; i++)
                    result.Add(player.hand[i]);
            }
        });
        return result;
    }

    float HashRotation(string id, int index)
    {
        int h = index * 7;
        foreach (char c in id)
            h = (h * 31 + (int)c);
        return ((h % 40) - 20) * (Mathf.PI / 180f);
    }

    Vector3 HandCenter(int visualPos)
    {
        switch (visualPos)
        {
            case 1: return new Vector3(-L.sideX, L.sideYOffset, 0.1f);
            case 2: return new Vector3(0, L.topY, 0.1f);
            case 3: return new Vector3(L.sideX, L.sideYOffset, 0.1f);
            default: return new Vector3(0, L.bottomY, 0.1f);
        }
    }

    // ================================================================
    // Update Loop
    // ================================================================

    void Update()
    {
        if (!net.IsConnected || net.State == null) return;

        RecalculateLayout();

        // Auto-draw timer
        if (autoDrawPending && autoDrawTimer > 0)
        {
            autoDrawTimer -= Time.deltaTime;
            if (autoDrawTimer <= 0)
            {
                autoDrawPending = false;
                net.SendMessage("draw_card");
            }
        }

        // Showcase timer
        if (showcaseCardId != null)
        {
            showcaseTimer -= Time.deltaTime;
            if (showcaseTimer <= 0)
            {
                showcaseCardId = null;
                UpdatePlayableSet();
            }
        }

        // Color picker animation
        UpdateColorPicker();

        // Build and update card renders
        BuildCardRenders();

        // Update all card entities
        foreach (var kvp in cardEntities)
            kvp.Value.Update(Time.deltaTime);

        // Active color ring
        UpdateActiveColorRing();

        // Turn indicator
        UpdateTurnIndicator();

        // Winner overlay
        UpdateWinnerOverlay();

        // Handle mouse input
        HandleInput();
    }

    // ================================================================
    // Card Render Building
    // ================================================================

    struct CardRenderData
    {
        public string key;
        public string textureId;
        public Vector3 position;
        public float rotationZ;
        public bool faceUp;
        public float scale;
        public bool shake;
        public Vector3? initialPosition;
    }

    void BuildCardRenders()
    {
        var state = net.State;
        if (state == null) return;

        var renders = new List<CardRenderData>();
        var placed = new HashSet<string>();

        // Compute animation origins
        var newCardAnims = ComputeNewCardAnimations();

        int discardLen = state.discardPile?.Count ?? 0;
        float discardBaseZ = 0.5f;
        float discardTopZ = discardBaseZ + discardLen * 0.02f;

        // --- Showcase card ---
        if (showcaseCardId != null)
        {
            UnoCardSchema showcaseCard = FindCardById(showcaseCardId);
            if (showcaseCard != null)
            {
                placed.Add(showcaseCard.id);
                renders.Add(new CardRenderData
                {
                    key = showcaseCard.id,
                    textureId = CardTextureFromSchema(showcaseCard),
                    position = new Vector3(0, 0, discardTopZ + 1f),
                    rotationZ = 0,
                    faceUp = true,
                    scale = L.showcaseScale,
                    shake = false,
                    initialPosition = null
                });
            }
        }

        // --- Discard pile ---
        if (state.discardPile != null)
        {
            for (int i = 0; i < discardLen; i++)
            {
                var card = state.discardPile[i];
                if (placed.Contains(card.id)) continue;
                placed.Add(card.id);

                newCardAnims.TryGetValue(card.id, out var initPos);
                renders.Add(new CardRenderData
                {
                    key = card.id,
                    textureId = CardTextureFromSchema(card),
                    position = new Vector3(
                        -L.pileX + (((i * 13) % 7) - 3) * 0.03f,
                        (((i * 7) % 5) - 2) * 0.03f,
                        discardBaseZ + i * 0.02f
                    ),
                    rotationZ = HashRotation(card.id, i),
                    faceUp = true,
                    scale = L.discardScale,
                    shake = false,
                    initialPosition = initPos
                });
            }
        }

        // --- Local player hand ---
        var localHand = GetLocalHand().Where(c => !placed.Contains(c.id)).ToList();
        for (int i = 0; i < localHand.Count; i++)
        {
            var card = localHand[i];
            placed.Add(card.id);

            float center = i - (localHand.Count - 1) / 2f;
            bool playable = playableSet.Contains(card.id);
            bool hovered = playable && card.id == hoveredCardId;
            bool colorMatch = hoveredPickerColor != null && card.cardType == "color" && card.color == hoveredPickerColor;

            float lift = colorMatch ? L.hoverLift * 0.5f :
                         playable ? L.hoverLift * 0.35f : 0;

            newCardAnims.TryGetValue(card.id, out var initPos);
            renders.Add(new CardRenderData
            {
                key = card.id,
                textureId = CardTextureFromSchema(card),
                position = new Vector3(
                    center * L.playerSpacing,
                    L.bottomY + (hovered ? L.hoverLift : lift) - Mathf.Abs(center) * 0.03f,
                    (localHand.Count - 1 - i) * 0.01f + (hovered ? 0.1f : 0)
                ),
                rotationZ = -center * 0.03f,
                faceUp = true,
                scale = hovered ? L.playerHoverScale : L.playerScale,
                shake = localHand.Count == 1 && state.winner == -1,
                initialPosition = initPos
            });
        }

        // --- Opponent hands ---
        if (state.players != null)
        {
            state.players.ForEach((key, player) =>
            {
                int vp = GetVisualPosition(player.seatIndex);
                if (vp == 0) return; // skip local

                for (int i = 0; i < player.handCount; i++)
                {
                    float center = i - (player.handCount - 1) / 2f;
                    Vector3 pos;
                    float rot;

                    if (vp == 1)
                    {
                        pos = new Vector3(-L.sideX, center * L.vSpacing + L.sideYOffset, i * 0.01f);
                        rot = Mathf.PI / 2f;
                    }
                    else if (vp == 2)
                    {
                        pos = new Vector3(center * L.hSpacing, L.topY, i * 0.01f);
                        rot = 0;
                    }
                    else
                    {
                        pos = new Vector3(L.sideX, center * L.vSpacing + L.sideYOffset, i * 0.01f);
                        rot = -Mathf.PI / 2f;
                    }

                    string opKey = $"opponent-{player.seatIndex}-{i}";
                    newCardAnims.TryGetValue(opKey, out var initPos);

                    renders.Add(new CardRenderData
                    {
                        key = opKey,
                        textureId = "back",
                        position = pos,
                        rotationZ = rot,
                        faceUp = false,
                        scale = L.opponentScale,
                        shake = player.handCount == 1 && state.winner == -1,
                        initialPosition = initPos
                    });
                }
            });
        }

        // --- Draw pile ---
        int drawCount = state.drawPileCount;
        int visibleCount = Mathf.Min(drawCount, 8);
        for (int i = 0; i < visibleCount; i++)
        {
            float depth = visibleCount > 1 ? (visibleCount - 1 - i) / (float)(visibleCount - 1) : 0;
            renders.Add(new CardRenderData
            {
                key = $"draw-{i}",
                textureId = "back",
                position = new Vector3(
                    L.pileX + depth * L.pileScale * 0.06f,
                    -depth * L.pileScale * 0.12f,
                    i * 0.008f
                ),
                rotationZ = 0,
                faceUp = false,
                scale = L.pileScale,
                shake = false,
                initialPosition = null
            });
        }

        // --- Apply renders to entities ---
        var activeKeys = new HashSet<string>();
        foreach (var r in renders)
        {
            activeKeys.Add(r.key);

            if (!cardEntities.TryGetValue(r.key, out var entity))
            {
                // Create new card entity
                entity = new CardEntity(
                    r.key,
                    GetTexture(r.textureId),
                    GetTexture("back"),
                    r.initialPosition
                );
                cardEntities[r.key] = entity;
            }
            else
            {
                // Update texture if changed
                entity.SetFrontTexture(GetTexture(r.textureId));
            }

            entity.SetTarget(r.position, r.rotationZ, r.faceUp, r.scale, r.shake);
        }

        // Remove entities that are no longer rendered
        var toRemove = new List<string>();
        foreach (var kvp in cardEntities)
        {
            if (!activeKeys.Contains(kvp.Key))
                toRemove.Add(kvp.Key);
        }
        foreach (var key in toRemove)
        {
            cardEntities[key].Destroy();
            cardEntities.Remove(key);
        }

        // Update tracking state (after render)
        UpdateTrackingState();
    }

    // ================================================================
    // Card Animation Origins
    // ================================================================

    Dictionary<string, Vector3?> ComputeNewCardAnimations()
    {
        var anims = new Dictionary<string, Vector3?>();
        var state = net.State;
        if (state == null) return anims;

        int discardLen = state.discardPile?.Count ?? 0;
        Vector3 drawPileOrigin = new Vector3(L.pileX, 0, 0);

        // New discard card: animate FROM the player who just played
        if (discardLen > prevDiscardLen && prevCurrentPlayer >= 0 && state.discardPile != null)
        {
            var newCard = state.discardPile[discardLen - 1];
            int fromVisualPos = GetVisualPosition(prevCurrentPlayer);
            if (fromVisualPos != 0) // Don't set for local player (showcase handles it)
            {
                anims[newCard.id] = HandCenter(fromVisualPos);
            }
        }

        // New opponent hand cards: animate FROM draw pile
        if (state.players != null)
        {
            state.players.ForEach((key, player) =>
            {
                int vp = GetVisualPosition(player.seatIndex);
                if (vp == 0) return;

                int prevCount = prevHandCounts.GetValueOrDefault(player.seatIndex, 0);
                if (player.handCount > prevCount)
                {
                    for (int i = prevCount; i < player.handCount; i++)
                        anims[$"opponent-{player.seatIndex}-{i}"] = drawPileOrigin;
                }
            });
        }

        // New local hand cards: animate FROM draw pile
        var localHand = GetLocalHand();
        foreach (var card in localHand)
        {
            if (!prevLocalHandIds.Contains(card.id))
                anims[card.id] = drawPileOrigin;
        }

        return anims;
    }

    void UpdateTrackingState()
    {
        var state = net.State;
        if (state == null) return;

        prevDiscardLen = state.discardPile?.Count ?? 0;
        prevCurrentPlayer = state.currentPlayer;

        prevHandCounts.Clear();
        if (state.players != null)
        {
            state.players.ForEach((key, player) =>
            {
                prevHandCounts[player.seatIndex] = player.handCount;
            });
        }

        prevLocalHandIds.Clear();
        foreach (var card in GetLocalHand())
            prevLocalHandIds.Add(card.id);
    }

    UnoCardSchema FindCardById(string cardId)
    {
        var state = net.State;
        if (state == null) return null;

        // Check local hand
        var localHand = GetLocalHand();
        foreach (var card in localHand)
        {
            if (card.id == cardId) return card;
        }

        // Check discard pile
        if (state.discardPile != null)
        {
            for (int i = 0; i < state.discardPile.Count; i++)
            {
                if (state.discardPile[i].id == cardId)
                    return state.discardPile[i];
            }
        }

        return null;
    }

    // ================================================================
    // Active Color Ring
    // ================================================================

    void UpdateActiveColorRing()
    {
        var state = net.State;
        bool show = state != null && state.phase == "playing";
        activeColorRingGroup.SetActive(show);
        if (!show) return;

        string ac = state.activeColor ?? "red";
        if (ac != prevActiveColor)
        {
            prevActiveColor = ac;
            // Punch animation: group scales up, inner shrinks (thicker ring)
            activeColorRingGroup.transform.localScale = Vector3.one * 1.8f;
            ringVelScale = 0;
            ringVelInner = 0;
            float innerR2 = 0.55f * L.discardScale;
            activeColorRingInner.transform.localScale = new Vector3(innerR2 * 0.8f, innerR2 * 0.8f, 1);
            ringTargetScale = 1f;
            ringTargetInner = 1f;

            // Update color
            var ringMat = activeColorRingOuter.GetComponent<Renderer>().material;
            ringMat.color = COLOR_HEX.GetValueOrDefault(ac, Color.red);
        }

        // Set base geometry sizes (circle meshes are unit radius 0.5)
        float outerR = 0.62f * L.discardScale;
        float innerR = 0.55f * L.discardScale;
        activeColorRingOuter.transform.localScale = new Vector3(outerR * 2, outerR * 2, 1);

        activeColorRingGroup.transform.position = new Vector3(-L.pileX, 0, 0.49f);

        // Spring animate group scale (punch effect)
        float dt = Mathf.Min(Time.deltaTime, 0.05f);
        {
            float cur = activeColorRingGroup.transform.localScale.x;
            float acc = 200f * (1f - cur) - 30f * ringVelScale;
            ringVelScale += acc * dt;
            float next = cur + ringVelScale * dt;
            activeColorRingGroup.transform.localScale = Vector3.one * next;
        }

        // Spring animate inner ring scale (thickening effect)
        {
            float cur = activeColorRingInner.transform.localScale.x;
            float targetInnerScale = innerR * 2;
            // ringVelInner spring toward target inner size
            float acc = 200f * (targetInnerScale - cur) - 30f * ringVelInner;
            ringVelInner += acc * dt;
            float next = cur + ringVelInner * dt;
            activeColorRingInner.transform.localScale = new Vector3(next, next, 1);
        }
    }

    // ================================================================
    // Turn Indicator
    // ================================================================

    void UpdateTurnIndicator()
    {
        var state = net.State;
        bool show = state != null && state.phase == "playing" && state.winner == -1;
        turnArrowGroup.SetActive(show);
        if (!show) return;

        int currentVisualPos = GetVisualPosition(state.currentPlayer);
        float targetAngle = PLAYER_ANGLE[currentVisualPos];

        if (turnArrowPrevPlayer != currentVisualPos)
        {
            float diff = targetAngle - turnArrowCurrentAngle;
            while (diff > Mathf.PI) diff -= Mathf.PI * 2f;
            while (diff < -Mathf.PI) diff += Mathf.PI * 2f;
            if (Mathf.Abs(diff) < 0.01f)
                diff = state.direction * Mathf.PI * 2f;
            turnArrowTargetAngle = turnArrowCurrentAngle + diff;
            turnArrowPrevPlayer = currentVisualPos;
        }

        // Spring physics for turn arrow (stiffness=120, damping=22)
        float dt = Mathf.Min(Time.deltaTime, 0.05f);
        float acc = 120f * (turnArrowTargetAngle - turnArrowCurrentAngle) - 22f * turnArrowVel;
        turnArrowVel += acc * dt;
        turnArrowCurrentAngle += turnArrowVel * dt;

        // Position arrow at radius
        float r = L.turnRadius;
        float ax = Mathf.Cos(turnArrowCurrentAngle) * r;
        float ay = Mathf.Sin(turnArrowCurrentAngle) * r;
        turnArrowMesh.transform.localPosition = new Vector3(ax, ay, 0);
        turnArrowMesh.transform.localEulerAngles = new Vector3(0, 0, turnArrowCurrentAngle * Mathf.Rad2Deg);

        // Arrow size
        float arrowSize = r * 0.15f;
        turnArrowMesh.transform.localScale = Vector3.one * arrowSize;

        // Direction arrows spin
        float spinSpeed = state.direction == 1 ? -0.1f : 0.1f;
        dirArrowGroup.transform.Rotate(0, 0, spinSpeed * dt * Mathf.Rad2Deg);

        // Rebuild direction arrows if needed
        UpdateDirectionArrows(r, state.direction);
    }

    private float lastDirArrowRadius = -1;
    private int lastDirArrowDirection = 0;

    void UpdateDirectionArrows(float radius, int direction)
    {
        if (Mathf.Approximately(lastDirArrowRadius, radius) && lastDirArrowDirection == direction)
            return;

        lastDirArrowRadius = radius;
        lastDirArrowDirection = direction;

        // Clear existing
        foreach (Transform child in dirArrowGroup.transform)
            Destroy(child.gameObject);

        float size = radius * 0.08f;
        for (int i = 0; i < 4; i++)
        {
            float a = (i / 4f) * Mathf.PI * 2f + Mathf.PI / 4f;
            float tangent = a + (direction == 1 ? -Mathf.PI / 2f : Mathf.PI / 2f);

            var arrow = CreateTriangle($"DirArrow_{i}", size, new Color(1, 1, 1, 0.3f));
            arrow.transform.SetParent(dirArrowGroup.transform, false);
            arrow.transform.localPosition = new Vector3(
                Mathf.Cos(a) * radius * 0.85f,
                Mathf.Sin(a) * radius * 0.85f,
                0
            );
            arrow.transform.localEulerAngles = new Vector3(0, 0, tangent * Mathf.Rad2Deg);
        }
    }

    // ================================================================
    // Color Picker
    // ================================================================

    void UpdateColorPicker()
    {
        bool active = colorPickerForCardId != null;
        colorPickerOverlay.SetActive(active);
        foreach (var c in colorPickerCircles) c.SetActive(active);

        if (!active)
        {
            colorPickerElapsed = 0;
            return;
        }

        float dt = Mathf.Min(Time.deltaTime, 0.05f);
        colorPickerElapsed += dt;

        // Overlay fade in
        float curOpacity = colorPickerOverlayMat.color.a;
        float accO = 200f * (0.5f - curOpacity) - 30f * colorPickerOverlayVel;
        colorPickerOverlayVel += accO * dt;
        float newOpacity = curOpacity + colorPickerOverlayVel * dt;
        colorPickerOverlayMat.color = new Color(0, 0, 0, Mathf.Clamp01(newOpacity));

        // Circle animations
        for (int i = 0; i < 4; i++)
        {
            float delay = (i + 1) * PICKER_STAGGER;
            float target = colorPickerElapsed > delay
                ? (hoveredPickerColor == PICKER_COLORS[i] ? 1.3f : 1f)
                : 0f;

            float cur = colorPickerCircles[i].transform.localScale.x;
            float acc = 200f * (target - cur) - 30f * colorPickerCircleVels[i];
            colorPickerCircleVels[i] += acc * dt;
            float next = Mathf.Max(0, cur + colorPickerCircleVels[i] * dt);
            colorPickerCircles[i].transform.localScale = Vector3.one * next;
        }
    }

    // ================================================================
    // Winner Overlay
    // ================================================================

    void UpdateWinnerOverlay()
    {
        var state = net.State;
        bool show = state != null && state.winner != -1;
        winnerOverlay3D.SetActive(show);
    }

    // ================================================================
    // Input Handling
    // ================================================================

    void HandleInput()
    {
        var state = net.State;
        if (state == null) return;

        // Color picker interaction
        if (colorPickerForCardId != null)
        {
            HandleColorPickerInput();
            return;
        }

        // Card interaction (only when it's our turn, no showcase, no winner)
        if (showcaseCardId != null || state.currentPlayer != localSeatIndex || state.winner != -1)
        {
            if (hoveredCardId != null)
            {
                hoveredCardId = null;
            }
            return;
        }

        HandleCardInput();
    }

    void HandleCardInput()
    {
        Ray ray = cam.ScreenPointToRay(Input.mousePosition);
        string newHovered = null;

        // Raycast against local hand cards
        var localHand = GetLocalHand();
        float bestDist = float.MaxValue;

        for (int i = 0; i < localHand.Count; i++)
        {
            var card = localHand[i];
            if (!cardEntities.TryGetValue(card.id, out var entity)) continue;

            // Simple AABB hit test around card position
            var cardPos = entity.root.transform.position;
            float hitW = L.playerSpacing * 0.5f;
            float hitH = L.playerScale * 0.6f;

            // Project ray to card's z plane
            if (Mathf.Abs(ray.direction.z) < 0.001f) continue;
            float t = (cardPos.z - ray.origin.z) / ray.direction.z;
            if (t < 0) continue;

            Vector3 hitPoint = ray.origin + ray.direction * t;
            float dx = Mathf.Abs(hitPoint.x - cardPos.x);
            float dy = Mathf.Abs(hitPoint.y - cardPos.y);

            if (dx < hitW && dy < hitH && t < bestDist)
            {
                bestDist = t;
                newHovered = card.id;
            }
        }

        // Only show hover for playable cards
        if (newHovered != null && !playableSet.Contains(newHovered))
            newHovered = null;

        hoveredCardId = newHovered;

        // Click to play card
        if (Input.GetMouseButtonDown(0) && hoveredCardId != null)
        {
            OnPlayCard(hoveredCardId);
        }
    }

    void OnPlayCard(string cardId)
    {
        if (showcaseCardId != null || colorPickerForCardId != null) return;

        var card = FindCardById(cardId);
        if (card == null || !playableSet.Contains(cardId)) return;

        if (card.cardType == "wild")
        {
            // Open color picker
            colorPickerForCardId = cardId;
            colorPickerElapsed = 0;
            colorPickerOverlayVel = 0;
            hoveredPickerColor = null;
            for (int i = 0; i < 4; i++)
            {
                colorPickerCircleVels[i] = 0;
                colorPickerCircles[i].transform.localScale = Vector3.zero;
            }
            colorPickerOverlayMat.color = new Color(0, 0, 0, 0);
            return;
        }

        // Send immediately, show showcase
        net.SendMessage("play_card", new Dictionary<string, object> { { "cardId", cardId } });
        hoveredCardId = null;
        showcaseCardId = cardId;
        showcaseTimer = SHOWCASE_DURATION;
        UpdatePlayableSet();
    }

    void HandleColorPickerInput()
    {
        Ray ray = cam.ScreenPointToRay(Input.mousePosition);
        string newHoveredColor = null;

        for (int i = 0; i < 4; i++)
        {
            var circle = colorPickerCircles[i];
            if (!circle.activeSelf) continue;

            // Simple distance check at z=2
            float t = (2f - ray.origin.z) / ray.direction.z;
            if (t < 0) continue;
            Vector3 hitPoint = ray.origin + ray.direction * t;

            float dist = Vector2.Distance(
                new Vector2(hitPoint.x, hitPoint.y),
                new Vector2(circle.transform.position.x, circle.transform.position.y)
            );

            if (dist < 0.35f * Mathf.Max(circle.transform.localScale.x, 0.5f))
            {
                newHoveredColor = PICKER_COLORS[i];
            }
        }

        hoveredPickerColor = newHoveredColor;

        if (Input.GetMouseButtonDown(0) && hoveredPickerColor != null)
        {
            string cardId = colorPickerForCardId;
            string color = hoveredPickerColor;

            // Send play card with chosen color
            net.SendMessage("play_card", new Dictionary<string, object>
            {
                { "cardId", cardId },
                { "chosenColor", color }
            });

            colorPickerForCardId = null;
            hoveredCardId = null;
            hoveredPickerColor = null;

            // Start showcase
            showcaseCardId = cardId;
            showcaseTimer = SHOWCASE_DURATION;
            UpdatePlayableSet();
        }
    }

    // ================================================================
    // Geometry Helpers
    // ================================================================

    static GameObject CreateCircle(string name, int segments, Color color)
    {
        var go = new GameObject(name);
        var mf = go.AddComponent<MeshFilter>();
        var mr = go.AddComponent<MeshRenderer>();

        var mesh = new Mesh();
        var verts = new Vector3[segments + 1];
        var tris = new int[segments * 3];

        verts[0] = Vector3.zero;
        for (int i = 0; i < segments; i++)
        {
            float angle = (i / (float)segments) * Mathf.PI * 2f;
            verts[i + 1] = new Vector3(Mathf.Cos(angle), Mathf.Sin(angle), 0) * 0.5f;
            tris[i * 3] = 0;
            tris[i * 3 + 1] = i + 1;
            tris[i * 3 + 2] = (i + 1) % segments + 1;
        }
        mesh.vertices = verts;
        mesh.triangles = tris;
        mesh.RecalculateNormals();
        mf.mesh = mesh;

        var mat = new Material(Shader.Find("Unlit/Color"));
        mat.color = color;
        mr.material = mat;

        return go;
    }

    static GameObject CreateTriangle(string name, float size, Color color)
    {
        var go = new GameObject(name);
        var mf = go.AddComponent<MeshFilter>();
        var mr = go.AddComponent<MeshRenderer>();

        var mesh = new Mesh();
        mesh.vertices = new Vector3[]
        {
            new Vector3(size, 0, 0),
            new Vector3(-size * 0.6f, size * 0.5f, 0),
            new Vector3(-size * 0.6f, -size * 0.5f, 0),
        };
        mesh.triangles = new int[] { 0, 1, 2 };
        mesh.RecalculateNormals();
        mf.mesh = mesh;

        var mat = new Material(Shader.Find("Unlit/Color"));
        mat.color = color;
        SetMaterialTransparent(mat);
        mr.material = mat;

        return go;
    }

    static GameObject CreateOverlayPlane(string name, Vector3 position, float opacity)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
        go.name = name;
        go.transform.position = position;
        go.transform.localScale = new Vector3(25f, 16f, 1f);
        Object.Destroy(go.GetComponent<Collider>());

        // Sprites/Default supports vertex-color alpha blending and has Cull Off,
        // which matters because PrimitiveType.Quad's normal faces -Z (our camera sits at +Z).
        var mat = new Material(Shader.Find("Sprites/Default"));
        mat.color = new Color(0, 0, 0, opacity);
        go.GetComponent<Renderer>().material = mat;

        return go;
    }

    public static void SetMaterialTransparent(Material mat)
    {
        mat.SetFloat("_Mode", 3);
        mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
        mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
        mat.SetInt("_ZWrite", 0);
        mat.DisableKeyword("_ALPHATEST_ON");
        mat.EnableKeyword("_ALPHABLEND_ON");
        mat.DisableKeyword("_ALPHAPREMULTIPLY_ON");
        mat.renderQueue = 3000;
    }
}
