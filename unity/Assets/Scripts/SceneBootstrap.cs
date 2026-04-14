using UnityEngine;

/// <summary>
/// Bootstraps the scene by creating all required GameObjects at runtime.
/// Attach this to an empty GameObject in the scene, or let it auto-create via [RuntimeInitializeOnLoadMethod].
/// This avoids complex .unity scene serialization and ensures all components are set up correctly.
/// </summary>
public class SceneBootstrap : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void AutoBootstrap()
    {
        // Only bootstrap if no GameManager exists yet
        if (FindObjectOfType<GameManager>() != null) return;
        if (FindObjectOfType<SceneBootstrap>() != null) return;

        var go = new GameObject("SceneBootstrap");
        go.AddComponent<SceneBootstrap>();
    }

    void Awake()
    {
        // ── Camera setup ──
        var cam = Camera.main;
        if (cam == null)
        {
            var camGO = new GameObject("Main Camera");
            camGO.tag = "MainCamera";
            cam = camGO.AddComponent<Camera>();
            camGO.AddComponent<AudioListener>();
        }
        cam.transform.position = new Vector3(0, -0.5f, 10f);
        cam.transform.LookAt(new Vector3(0, -0.5f, 0));
        cam.fieldOfView = 50f;
        cam.nearClipPlane = 0.3f;
        cam.farClipPlane = 1000f;
        cam.backgroundColor = new Color(0.08f, 0.353f, 0.125f);
        cam.clearFlags = CameraClearFlags.SolidColor;

        // ── GameController object with all managers ──
        var controller = new GameObject("GameController");

        // NetworkManager (singleton, DontDestroyOnLoad)
        if (NetworkManager.Instance == null)
        {
            var netGO = new GameObject("NetworkManager");
            netGO.AddComponent<NetworkManager>();
        }

        // GameManager
        var gm = controller.AddComponent<GameManager>();

        // HUDManager
        var hud = controller.AddComponent<HUDManager>();

        // LobbyManager
        var lobby = controller.AddComponent<LobbyManager>();
        lobby.gameManager = gm;
        lobby.hudManager = hud;
    }
}
