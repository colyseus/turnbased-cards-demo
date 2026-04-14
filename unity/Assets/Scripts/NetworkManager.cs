using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using Colyseus;
using Colyseus.Schema;

/// <summary>
/// Singleton wrapper around the Colyseus client and room.
/// Provides connection methods and exposes the room/state for other managers.
/// </summary>
public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }

    [Header("Server")]
    public string serverUrl = "ws://localhost:2567";

    public Client Client { get; private set; }
    public Room<UnoRoomState> Room { get; private set; }
    public UnoRoomState State => Room?.State;
    public string SessionId => Room?.SessionId;
    public string RoomId => Room?.RoomId;
    public bool IsConnected => Room != null;

    /// <summary>
    /// Fired every time the server state changes.
    /// </summary>
    public event Action OnStateChanged;

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        // Override server URL in non-development release builds
        if (!Debug.isDebugBuild)
            serverUrl = "wss://uno-demo.colyseus.dev";

        Client = new Client(serverUrl);
    }

    /// <summary>
    /// Join or create a room with the given name and options.
    /// Waits for the first state sync before returning.
    /// </summary>
    public async Task<Room<UnoRoomState>> JoinOrCreate(string roomName, Dictionary<string, object> options)
    {
        var room = await Client.JoinOrCreate<UnoRoomState>(roomName, options);
        return await ConnectRoom(room);
    }

    /// <summary>
    /// Join a specific room by ID.
    /// Waits for the first state sync before returning.
    /// </summary>
    public async Task<Room<UnoRoomState>> JoinById(string roomId, Dictionary<string, object> options)
    {
        var room = await Client.JoinById<UnoRoomState>(roomId, options);
        return await ConnectRoom(room);
    }

    private async Task<Room<UnoRoomState>> ConnectRoom(Room<UnoRoomState> room)
    {
        Room = room;

        // Wait for the initial state to arrive
        var tcs = new TaskCompletionSource<bool>();
        bool initialSync = true;

        room.OnStateChange += (state, isFirstState) =>
        {
            if (initialSync)
            {
                initialSync = false;
                tcs.TrySetResult(true);
            }
            OnStateChanged?.Invoke();
        };

        await tcs.Task;

        Debug.Log($"Joined room {room.RoomId} as {room.SessionId}");
        return room;
    }

    public void SendMessage(string type, object message = null)
    {
        if (Room == null) return;
        if (message != null)
            _ = Room.Send(type, message);
        else
            _ = Room.Send(type);
    }

    async void OnDestroy()
    {
        if (Room != null)
            await Room.Leave();
    }
}
