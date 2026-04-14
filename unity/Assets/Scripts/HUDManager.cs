using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// HUD overlay for player labels, room code, turn timer, and winner screen.
/// Uses Unity IMGUI for simplicity (matching the tanks demo pattern).
/// </summary>
public class HUDManager : MonoBehaviour
{
    // Turn timer constants
    private const float HUMAN_TURN_MS = 7000f;
    private const float BOT_TURN_MS = 800f;

    // Clipboard feedback
    private bool copied;
    private float copiedTimer;

    // GUI styles
    private GUIStyle labelStyle, activeLabelStyle, cardCountStyle;
    private GUIStyle roomCodeStyle, roomCodeCopiedStyle;
    private GUIStyle winnerTextStyle, newGameBtnStyle;
    private GUIStyle timerBgStyle, timerFillStyle;
    private bool stylesInit;

    private NetworkManager net;

    void Start()
    {
        net = NetworkManager.Instance;
    }

    void Update()
    {
        if (copied)
        {
            copiedTimer -= Time.deltaTime;
            if (copiedTimer <= 0)
                copied = false;
        }
    }

    int GetLocalSeatIndex()
    {
        if (net?.State?.players == null || net.SessionId == null) return 0;
        int seat = 0;
        net.State.players.ForEach((key, player) =>
        {
            if (player.sessionId == net.SessionId) seat = player.seatIndex;
        });
        return seat;
    }

    int GetVisualPosition(int seatIndex, int localSeatIndex)
    {
        return ((seatIndex - localSeatIndex) + 4) % 4;
    }

    void InitStyles()
    {
        if (stylesInit) return;
        stylesInit = true;

        labelStyle = new GUIStyle(GUI.skin.label);
        labelStyle.fontSize = 13;
        labelStyle.fontStyle = FontStyle.Bold;
        labelStyle.normal.textColor = new Color(1, 1, 1, 0.7f);
        labelStyle.alignment = TextAnchor.MiddleCenter;

        activeLabelStyle = new GUIStyle(labelStyle);
        activeLabelStyle.normal.textColor = new Color(1f, 0.8f, 0f); // #ffcc00

        cardCountStyle = new GUIStyle(GUI.skin.label);
        cardCountStyle.fontSize = 11;
        cardCountStyle.fontStyle = FontStyle.Bold;
        cardCountStyle.alignment = TextAnchor.MiddleCenter;
        cardCountStyle.normal.textColor = Color.white;
        var countBg = new Texture2D(1, 1);
        countBg.SetPixel(0, 0, new Color(0, 0, 0, 0.4f));
        countBg.Apply();
        cardCountStyle.normal.background = countBg;

        roomCodeStyle = new GUIStyle(GUI.skin.label);
        roomCodeStyle.fontSize = 12;
        roomCodeStyle.fontStyle = FontStyle.Bold;
        roomCodeStyle.normal.textColor = new Color(1, 1, 1, 0.5f);
        roomCodeStyle.alignment = TextAnchor.MiddleLeft;

        roomCodeCopiedStyle = new GUIStyle(roomCodeStyle);
        roomCodeCopiedStyle.normal.textColor = new Color(1f, 0.8f, 0f);

        winnerTextStyle = new GUIStyle(GUI.skin.label);
        winnerTextStyle.fontSize = 42;
        winnerTextStyle.fontStyle = FontStyle.Bold;
        winnerTextStyle.alignment = TextAnchor.MiddleCenter;
        winnerTextStyle.normal.textColor = new Color(1f, 0.8f, 0f);

        newGameBtnStyle = new GUIStyle(GUI.skin.button);
        newGameBtnStyle.fontSize = 16;
        newGameBtnStyle.fontStyle = FontStyle.Bold;
        newGameBtnStyle.alignment = TextAnchor.MiddleCenter;
        newGameBtnStyle.normal.textColor = new Color(0.1f, 0.1f, 0.1f);
        newGameBtnStyle.fixedHeight = 44;

        var btnTex = new Texture2D(1, 1);
        btnTex.SetPixel(0, 0, new Color(1f, 0.8f, 0f));
        btnTex.Apply();
        newGameBtnStyle.normal.background = btnTex;
        newGameBtnStyle.hover.background = btnTex;
        newGameBtnStyle.active.background = btnTex;

        timerBgStyle = new GUIStyle();
        var tbg = new Texture2D(1, 1);
        tbg.SetPixel(0, 0, new Color(1, 1, 1, 0.15f));
        tbg.Apply();
        timerBgStyle.normal.background = tbg;

        timerFillStyle = new GUIStyle();
        var tfill = new Texture2D(1, 1);
        tfill.SetPixel(0, 0, new Color(0.2f, 0.733f, 0.267f));
        tfill.Apply();
        timerFillStyle.normal.background = tfill;
    }

    void OnGUI()
    {
        if (net == null || !net.IsConnected || net.State == null) return;
        var state = net.State;

        InitStyles();

        int localSeatIndex = GetLocalSeatIndex();

        // ── Room code (top-left) ──
        DrawRoomCode();

        // ── Player labels ──
        DrawPlayerLabels(localSeatIndex);

        // ── Winner overlay ──
        if (state.winner != -1)
        {
            DrawWinnerOverlay(localSeatIndex);
        }
    }

    void DrawRoomCode()
    {
        string text = copied ? "Copied!" : (net.RoomId ?? "");
        var style = copied ? roomCodeCopiedStyle : roomCodeStyle;

        Rect codeRect = new Rect(16, 12, 200, 20);
        GUI.Label(codeRect, text, style);

        // Click to copy
        if (Event.current.type == EventType.MouseDown && codeRect.Contains(Event.current.mousePosition))
        {
            GUIUtility.systemCopyBuffer = net.RoomId ?? "";
            copied = true;
            copiedTimer = 1.5f;
        }
    }

    void DrawPlayerLabels(int localSeatIndex)
    {
        var state = net.State;
        if (state.players == null) return;

        state.players.ForEach((key, player) =>
        {
            int vp = GetVisualPosition(player.seatIndex, localSeatIndex);
            bool isActive = state.currentPlayer == player.seatIndex && state.winner == -1;

            Rect labelRect = GetLabelRect(vp);
            var style = isActive ? activeLabelStyle : labelStyle;

            // Scale effect for active player
            if (isActive)
            {
                var matrix = GUI.matrix;
                Vector2 pivot = new Vector2(labelRect.center.x, labelRect.center.y);
                GUIUtility.ScaleAroundPivot(Vector2.one * 1.1f, pivot);
                GUI.Label(labelRect, player.name, style);
                GUI.matrix = matrix;
            }
            else
            {
                GUI.Label(labelRect, player.name, style);
            }

            // Card count badge
            Rect countRect = new Rect(labelRect.xMax + 4, labelRect.y + 2, 24, 18);
            if (isActive)
                countRect = new Rect(labelRect.xMax + 8, labelRect.y, 26, 20);
            GUI.Label(countRect, player.handCount.ToString(), cardCountStyle);

            // Turn timer
            if (isActive && state.turnDeadline > 0)
            {
                DrawTurnTimer(labelRect, state.turnDeadline, player.isBot);
            }
        });
    }

    Rect GetLabelRect(int visualPos)
    {
        float w = 120, h = 20;
        switch (visualPos)
        {
            case 0: // bottom center
                return new Rect((Screen.width - w) / 2f, Screen.height - Screen.height * 0.04f - h, w, h);
            case 1: // left
                return new Rect(Screen.width * 0.02f, (Screen.height - h) / 2f, w, h);
            case 2: // top center
                return new Rect((Screen.width - w) / 2f, Screen.height * 0.04f, w, h);
            case 3: // right
                return new Rect(Screen.width - Screen.width * 0.02f - w, (Screen.height - h) / 2f, w, h);
            default:
                return new Rect(0, 0, w, h);
        }
    }

    void DrawTurnTimer(Rect labelRect, double deadline, bool isBot)
    {
        float duration = isBot ? BOT_TURN_MS : HUMAN_TURN_MS;
        double now = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        float remaining = Mathf.Max(0, (float)(deadline - now));
        float progress = Mathf.Clamp01(remaining / duration);

        // Timer bar next to label
        float barW = 40, barH = 4;
        Rect barRect = new Rect(labelRect.x, labelRect.yMax + 2, barW, barH);

        // Background
        GUI.Box(barRect, GUIContent.none, timerBgStyle);

        // Progress fill with color
        Color timerColor;
        if (progress > 0.5f)
            timerColor = new Color(0.2f, 0.733f, 0.267f); // green
        else if (progress > 0.2f)
            timerColor = new Color(1f, 0.8f, 0f); // yellow
        else
            timerColor = new Color(1f, 0.267f, 0.267f); // red

        var fillTex = timerFillStyle.normal.background;
        if (fillTex != null)
        {
            fillTex.SetPixel(0, 0, timerColor);
            fillTex.Apply();
        }

        GUI.Box(new Rect(barRect.x, barRect.y, barW * progress, barH), GUIContent.none, timerFillStyle);
    }

    void DrawWinnerOverlay(int localSeatIndex)
    {
        var state = net.State;

        // Semi-transparent background
        var bgTex = new Texture2D(1, 1);
        bgTex.SetPixel(0, 0, new Color(0, 0, 0, 0.5f));
        bgTex.Apply();
        GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), bgTex);

        // Find winner name
        string winnerName = "???";
        state.players.ForEach((key, player) =>
        {
            if (player.seatIndex == state.winner)
                winnerName = player.name;
        });

        // Winner text
        GUI.Label(
            new Rect(0, Screen.height / 2f - 60, Screen.width, 60),
            $"{winnerName} WINS!",
            winnerTextStyle
        );

        // New Game button
        float btnW = 200, btnH = 44;
        if (GUI.Button(
            new Rect((Screen.width - btnW) / 2f, Screen.height / 2f + 20, btnW, btnH),
            "NEW GAME",
            newGameBtnStyle))
        {
            net.SendMessage("restart");
        }
    }
}
