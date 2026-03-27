// =============================================================================
// obj_lobby - Step Event
// =============================================================================

// --- Process Colyseus events ---
colyseus_process();

// --- Mouse click detection ---
if (mouse_check_button_pressed(mb_left)) {
    var mx = device_mouse_x_to_gui(0);
    var my = device_mouse_y_to_gui(0);

    // Check name input click
    if (point_in_rectangle(mx, my, name_input_x1, name_input_y1, name_input_x2, name_input_y2)) {
        focused_input = 0;
        keyboard_string = player_name;
    }
    // Check code input click
    else if (point_in_rectangle(mx, my, code_input_rect_x1, code_input_rect_y1, code_input_rect_x2, code_input_rect_y2)) {
        focused_input = 1;
        keyboard_string = room_code;
    }
    // Check Quick Play button
    else if (!joining && point_in_rectangle(mx, my, btn_quick_x1, btn_quick_y1, btn_quick_x2, btn_quick_y2)) {
        // Quick Play
        joining = true;
        error_message = "";
        var _name = (player_name == "") ? "Player" : player_name;

        var server_url = "ws://localhost:2567";
        var client = colyseus_client_create(server_url);
        global.net_client = client;
        global.net_room = colyseus_client_join_or_create(client, "uno", "{\"name\": \"" + _name + "\"}");

        // Set up room callbacks
        setup_room_callbacks(global.net_room);
    }
    // Check Join button
    else if (!joining && room_code != "" && point_in_rectangle(mx, my, btn_join_x1, btn_join_y1, btn_join_x2, btn_join_y2)) {
        joining = true;
        error_message = "";
        var _name = (player_name == "") ? "Player" : player_name;

        var server_url = "ws://localhost:2567";
        var client = colyseus_client_create(server_url);
        global.net_client = client;
        global.net_room = colyseus_client_join_by_id(client, room_code, "{\"name\": \"" + _name + "\"}");

        setup_room_callbacks(global.net_room);
    }
}

// --- Keyboard input for focused field ---
if (keyboard_check_pressed(vk_tab)) {
    focused_input = (focused_input + 1) mod 2;
    if (focused_input == 0) keyboard_string = player_name;
    else keyboard_string = room_code;
}

// Read keyboard_string changes
if (focused_input == 0) {
    // Name input (max 16 chars)
    player_name = string_copy(keyboard_string, 1, min(string_length(keyboard_string), 16));
    keyboard_string = player_name;
} else {
    // Room code input
    room_code = keyboard_string;
}

// Enter key to Quick Play
if (keyboard_check_pressed(vk_enter) && !joining) {
    if (focused_input == 0 || room_code == "") {
        // Quick Play
        joining = true;
        error_message = "";
        var _name = (player_name == "") ? "Player" : player_name;

        var server_url = "ws://localhost:2567";
        var client = colyseus_client_create(server_url);
        global.net_client = client;
        global.net_room = colyseus_client_join_or_create(client, "uno", "{\"name\": \"" + _name + "\"}");
        setup_room_callbacks(global.net_room);
    } else {
        // Join by code
        joining = true;
        error_message = "";
        var _name = (player_name == "") ? "Player" : player_name;

        var server_url = "ws://localhost:2567";
        var client = colyseus_client_create(server_url);
        global.net_client = client;
        global.net_room = colyseus_client_join_by_id(client, room_code, "{\"name\": \"" + _name + "\"}");
        setup_room_callbacks(global.net_room);
    }
}

// --- Setup room callbacks function ---
/// @func setup_room_callbacks(net_room)
function setup_room_callbacks(net_room) {
    colyseus_on_error(net_room, function(code, msg) {
        show_debug_message("Room error [" + string(code) + "]: " + msg);
        obj_lobby.error_message = "Failed to connect. Is server running?";
        obj_lobby.joining = false;
    });

    colyseus_on_leave(net_room, method(id, function(code, reason) {
        show_debug_message("Left room [" + string(code) + "]: " + reason);
        global.net_connected = false;
    }));

    colyseus_on_join(net_room, method(id, function(_room) {
        global.net_connected = true;
        global.net_session_id = colyseus_room_get_session_id(_room);
        global.net_room_id = colyseus_room_get_id(_room);
        show_debug_message("Joined UNO room: " + global.net_room_id);
        show_debug_message("Session ID: " + global.net_session_id);

        // Transition to game room
        room_goto(rm_game);
    }));
}
