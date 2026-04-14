using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Lobby screen using Unity's IMGUI system.
/// Handles Quick Play, Join by Code, and transitions to the game.
/// </summary>
public class LobbyManager : MonoBehaviour
{
    [Header("References")]
    public GameManager gameManager;
    public HUDManager hudManager;

    private string playerName = "";
    private string roomCode = "";
    private bool joining = false;
    private string errorText = "";
    private bool inGame = false;

    // GUI styles
    private GUIStyle titleStyle;
    private GUIStyle subtitleStyle;
    private GUIStyle inputStyle;
    private GUIStyle buttonStyle;
    private GUIStyle dividerStyle;
    private GUIStyle errorStyle;
    private GUIStyle joinButtonStyle;
    private bool stylesInitialized;

    void Start()
    {
        // Hide game objects until connected
        if (gameManager != null) gameManager.enabled = false;
        if (hudManager != null) hudManager.enabled = false;
    }

    void InitStyles()
    {
        if (stylesInitialized) return;
        stylesInitialized = true;

        titleStyle = new GUIStyle(GUI.skin.label);
        titleStyle.fontSize = 48;
        titleStyle.fontStyle = FontStyle.Bold;
        titleStyle.alignment = TextAnchor.MiddleCenter;
        titleStyle.wordWrap = false;
        titleStyle.normal.textColor = new Color(1f, 0.8f, 0f); // #ffcc00

        subtitleStyle = new GUIStyle(GUI.skin.label);
        subtitleStyle.fontSize = 14;
        subtitleStyle.alignment = TextAnchor.MiddleCenter;
        subtitleStyle.normal.textColor = new Color(1, 1, 1, 0.5f);

        inputStyle = new GUIStyle(GUI.skin.textField);
        inputStyle.fontSize = 16;
        inputStyle.alignment = TextAnchor.MiddleCenter;
        inputStyle.fixedHeight = 40;
        inputStyle.normal.textColor = Color.white;

        buttonStyle = new GUIStyle(GUI.skin.button);
        buttonStyle.fontSize = 16;
        buttonStyle.fontStyle = FontStyle.Bold;
        buttonStyle.fixedHeight = 44;
        buttonStyle.normal.textColor = new Color(0.1f, 0.1f, 0.1f);

        var btnTex = new Texture2D(1, 1);
        btnTex.SetPixel(0, 0, new Color(1f, 0.8f, 0f));
        btnTex.Apply();
        buttonStyle.normal.background = btnTex;
        buttonStyle.hover.background = btnTex;
        buttonStyle.active.background = btnTex;

        dividerStyle = new GUIStyle(GUI.skin.label);
        dividerStyle.fontSize = 12;
        dividerStyle.alignment = TextAnchor.MiddleCenter;
        dividerStyle.normal.textColor = new Color(1, 1, 1, 0.35f);

        errorStyle = new GUIStyle(GUI.skin.label);
        errorStyle.fontSize = 13;
        errorStyle.alignment = TextAnchor.MiddleCenter;
        errorStyle.normal.textColor = new Color(1f, 0.42f, 0.42f); // #ff6b6b

        joinButtonStyle = new GUIStyle(buttonStyle);
        joinButtonStyle.fixedHeight = 40;
    }

    void OnGUI()
    {
        if (inGame) return;

        InitStyles();

        // Background
        var bgTex = new Texture2D(1, 1);
        bgTex.SetPixel(0, 0, new Color(0.08f, 0.353f, 0.125f));
        bgTex.Apply();
        GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), bgTex);

        float w = 280;
        float x = (Screen.width - w) / 2f;
        float y = Screen.height * 0.2f;

        // Title — drawn in a wider rect so the 48pt bold text isn't clipped.
        float titleW = Mathf.Max(w, 480);
        GUI.Label(new Rect((Screen.width - titleW) / 2f, y, titleW, 60), "CARD GAME", titleStyle);
        y += 65;

        // Subtitle
        GUI.Label(new Rect(x, y, w, 25), "COLYSEUS DEMO", subtitleStyle);
        y += 40;

        // Name input
        GUI.SetNextControlName("NameInput");
        playerName = GUI.TextField(new Rect(x, y, w, 40), playerName, 16, inputStyle);
        if (string.IsNullOrEmpty(playerName) && GUI.GetNameOfFocusedControl() != "NameInput")
        {
            var placeholderStyle = new GUIStyle(inputStyle);
            placeholderStyle.normal.textColor = new Color(1, 1, 1, 0.3f);
            GUI.Label(new Rect(x, y, w, 40), "Enter your name...", placeholderStyle);
        }
        y += 50;

        // Quick Play button
        GUI.enabled = !joining;
        if (GUI.Button(new Rect(x, y, w, 44), "QUICK PLAY", buttonStyle))
        {
            HandleQuickPlay();
        }
        y += 55;

        // Divider
        GUI.enabled = true;
        GUI.Label(new Rect(x, y, w, 20), "or join by code", dividerStyle);
        y += 30;

        // Join by code row
        float codeW = 170;
        float joinBtnW = w - codeW - 10;
        GUI.SetNextControlName("CodeInput");
        roomCode = GUI.TextField(new Rect(x, y, codeW, 40), roomCode, inputStyle);
        if (string.IsNullOrEmpty(roomCode) && GUI.GetNameOfFocusedControl() != "CodeInput")
        {
            var placeholderStyle = new GUIStyle(inputStyle);
            placeholderStyle.normal.textColor = new Color(1, 1, 1, 0.3f);
            GUI.Label(new Rect(x, y, codeW, 40), "Room code...", placeholderStyle);
        }

        GUI.enabled = !joining && !string.IsNullOrEmpty(roomCode.Trim());
        if (GUI.Button(new Rect(x + codeW + 10, y, joinBtnW, 40), "JOIN", joinButtonStyle))
        {
            HandleJoinByCode();
        }
        GUI.enabled = true;
        y += 50;

        // Error text
        if (!string.IsNullOrEmpty(errorText))
        {
            GUI.Label(new Rect(x, y, w, 25), errorText, errorStyle);
        }

        // Joining indicator
        if (joining)
        {
            var joiningStyle = new GUIStyle(GUI.skin.label);
            joiningStyle.fontSize = 14;
            joiningStyle.alignment = TextAnchor.MiddleCenter;
            joiningStyle.normal.textColor = new Color(1, 1, 1, 0.6f);
            GUI.Label(new Rect(x, y + 25, w, 25), "Connecting...", joiningStyle);
        }
    }

    async void HandleQuickPlay()
    {
        joining = true;
        errorText = "";

        string name = string.IsNullOrWhiteSpace(playerName) ? "Player" : playerName.Trim();

        try
        {
            await NetworkManager.Instance.JoinOrCreate("uno", new Dictionary<string, object> { { "name", name } });
            TransitionToGame();
        }
        catch (System.Exception e)
        {
            errorText = e.Message ?? "Failed to connect";
            joining = false;
        }
    }

    async void HandleJoinByCode()
    {
        if (string.IsNullOrWhiteSpace(roomCode)) return;

        joining = true;
        errorText = "";

        string name = string.IsNullOrWhiteSpace(playerName) ? "Player" : playerName.Trim();

        try
        {
            await NetworkManager.Instance.JoinById(roomCode.Trim(), new Dictionary<string, object> { { "name", name } });
            TransitionToGame();
        }
        catch (System.Exception e)
        {
            errorText = e.Message ?? "Failed to join room";
            joining = false;
        }
    }

    void TransitionToGame()
    {
        inGame = true;
        if (gameManager != null) gameManager.enabled = true;
        if (hudManager != null) hudManager.enabled = true;
    }
}
