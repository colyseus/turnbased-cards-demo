// =============================================================================
// obj_game - Create Event
// =============================================================================

// --- Globals (initialized in lobby, but ensure defaults) ---
if (!variable_global_exists("net_connected")) global.net_connected = false;
if (!variable_global_exists("net_room")) global.net_room = 0;
if (!variable_global_exists("net_session_id")) global.net_session_id = "";
if (!variable_global_exists("net_room_id")) global.net_room_id = "";

// --- Game state (populated by Colyseus callbacks) ---
local_seat_index = 0;
current_player = 0;
direction = 1;
active_color = "red";
pending_draw = 0;
winner = -1;
phase = PHASE_WAITING;
turn_deadline = 0;
draw_pile_count = 0;

// --- Player data (struct map: seat_index_str -> player_data struct) ---
players = {};

// --- Local player hand (array of card structs) ---
local_hand = [];

// --- Discard pile (array of card structs) ---
discard_pile = [];

// --- UI State ---
hovered_card = "";
showcase_card_id = "";
showcase_timer = 0;
color_picker_for = "";          // card ID when color picker is open
hovered_picker_color = "";      // "red"/"blue"/"green"/"yellow" or ""
copied_timer = 0;               // room code copied feedback

// --- Previous state for animation tracking ---
prev_discard_len = 0;
prev_current_player = -1;
prev_hand_counts = {};          // seat_index_str -> count
prev_local_hand_ids = {};       // card_id -> true

// --- Restart transition flags (clear collections on first new-game on_add) ---
restart_hand_clear_pending = false;
restart_discard_clear_pending = false;

// --- Card animation pool: key -> { cx,cy,cr,cs,cf, vx,vy,vr,vs,vf, tex,z,blend,shake,shake_time,mounted } ---
card_pool = {};

// --- Turn indicator ---
arrow_angle = PLAYER_ANGLE_BOTTOM;
arrow_vel = 0;
arrow_target = PLAYER_ANGLE_BOTTOM;
prev_arrow_target = PLAYER_ANGLE_BOTTOM;
dir_spin = 0;

// --- Active color ring animation ---
ring_scale = 1;
ring_scale_vel = 0;
ring_inner_scale = 1;
ring_inner_vel = 0;
prev_active_color = "";

// --- Shake timer (for UNO wobble) ---
shake_time = 0;

// --- Callbacks handle ---
callbacks = 0;

// =============================================================================
// Set up Colyseus state listeners
// =============================================================================

var net_room = global.net_room;
if (net_room == 0) {
    show_debug_message("[obj_game] WARNING: No room reference, skipping callbacks");
    exit;
}

// Create callbacks
callbacks = colyseus_callbacks_create(net_room);

// --- Root state fields ---
colyseus_listen(callbacks, "currentPlayer", method({ game: id }, function(v, prev) {
    game.prev_current_player = game.current_player;
    game.current_player = v;
}));

colyseus_listen(callbacks, "direction", method({ game: id }, function(v, prev) {
    game.direction = v;
}));

colyseus_listen(callbacks, "activeColor", method({ game: id }, function(v, prev) {
    game.prev_active_color = game.active_color;
    game.active_color = v;
    // Trigger ring pulse animation
    game.ring_scale = 1.8;
    game.ring_scale_vel = 0;
    game.ring_inner_scale = 0.4;
    game.ring_inner_vel = 0;
}));

colyseus_listen(callbacks, "pendingDraw", method({ game: id }, function(v, prev) {
    game.pending_draw = v;
}));

colyseus_listen(callbacks, "winner", method({ game: id }, function(v, prev) {
    // Game ended — flag collections for clearing when new cards arrive
    if (v != -1) {
        game.restart_hand_clear_pending = true;
        game.restart_discard_clear_pending = true;
    }
    // New game: clear animations and UI state only.
    if (v == -1 && prev != -1) {
        game.card_pool = {};
        game.showcase_card_id = "";
        game.showcase_timer = 0;
        game.color_picker_for = "";
        game.hovered_card = "";
        game.prev_discard_len = 0;
        game.prev_current_player = -1;
        game.prev_local_hand_ids = {};
        game.prev_hand_counts = {};
        game.draw_pile_count = 0;
    }
    game.winner = v;
}));

colyseus_listen(callbacks, "phase", method({ game: id }, function(v, prev) {
    game.phase = v;
}));

colyseus_listen(callbacks, "turnDeadline", method({ game: id }, function(v, prev) {
    game.turn_deadline = v;
}));

colyseus_listen(callbacks, "drawPileCount", method({ game: id }, function(v, prev) {
    game.draw_pile_count = v;
}));

// =============================================================================
// Players (MapSchema, keyed by seat index string "0"-"3")
// =============================================================================

colyseus_on_add(callbacks, "players", method(id, function(instance, key) {
    show_debug_message("Player onAdd: seat=" + key);

    var _seat = real(key);
    var _session_id = colyseus_schema_get(instance, "sessionId");
    var _name = colyseus_schema_get(instance, "name");
    var _hand_count = colyseus_schema_get(instance, "handCount");
    var _is_bot = colyseus_schema_get(instance, "isBot");
    var _connected = colyseus_schema_get(instance, "connected");

    var p = {
        session_id: _session_id,
        seat_index: _seat,
        name: _name,
        is_bot: _is_bot > 0.5,
        connected: _connected > 0.5,
        hand_count: _hand_count,
        instance: instance
    };

    players[$ key] = p;

    // Detect local player
    if (_session_id == global.net_session_id) {
        local_seat_index = _seat;
        show_debug_message("  -> This is MY seat: " + string(_seat));
    }

    // Store initial hand count
    prev_hand_counts[$ key] = _hand_count;

    // --- Field listeners ---
    colyseus_listen(callbacks, instance, "handCount", method({ game: id, seat_key: key }, function(v, prev) {
        if (variable_struct_exists(game.players, seat_key)) {
            game.players[$ seat_key].hand_count = v;
        }
    }));

    colyseus_listen(callbacks, instance, "name", method({ game: id, seat_key: key }, function(v, prev) {
        if (variable_struct_exists(game.players, seat_key)) {
            game.players[$ seat_key].name = v;
        }
    }));

    colyseus_listen(callbacks, instance, "connected", method({ game: id, seat_key: key }, function(v, prev) {
        if (variable_struct_exists(game.players, seat_key)) {
            game.players[$ seat_key].connected = v > 0.5;
        }
    }));

    colyseus_listen(callbacks, instance, "isBot", method({ game: id, seat_key: key }, function(v, prev) {
        if (variable_struct_exists(game.players, seat_key)) {
            game.players[$ seat_key].is_bot = v > 0.5;
        }
    }));

    colyseus_listen(callbacks, instance, "sessionId", method({ game: id, seat_key: key }, function(v, prev) {
        if (variable_struct_exists(game.players, seat_key)) {
            game.players[$ seat_key].session_id = v;
            if (v == global.net_session_id) {
                game.local_seat_index = real(seat_key);
            }
        }
    }));

    // --- Hand (ArraySchema, only visible for local player via StateView) ---
    colyseus_on_add(callbacks, instance, "hand", method({ game: id, seat_key: key }, function(card_instance, card_key) {
        // Clear stale cards from previous game on first new card arrival
        if (game.restart_hand_clear_pending) {
            game.local_hand = [];
            game.restart_hand_clear_pending = false;
        }

        // Only local player's hand is visible
        var _id = colyseus_schema_get(card_instance, "id");
        var _card_type = colyseus_schema_get(card_instance, "cardType");
        var _color = colyseus_schema_get(card_instance, "color");
        var _value = colyseus_schema_get(card_instance, "value");
        var _chosen = colyseus_schema_get(card_instance, "chosenColor");
        if (is_undefined(_chosen)) _chosen = "";

        // Replace if card with this ID already exists
        for (var _di = array_length(game.local_hand) - 1; _di >= 0; _di--) {
            if (game.local_hand[_di].id == _id) {
                array_delete(game.local_hand, _di, 1);
                break;
            }
        }

        var card = {
            id: _id,
            card_type: _card_type,
            color: _color,
            value: _value,
            chosen_color: _chosen,
            instance: card_instance
        };

        array_push(game.local_hand, card);
        show_debug_message("  Hand card added: " + _id);
    }));

    colyseus_on_remove(callbacks, instance, "hand", method({ game: id }, function(card_instance, card_key) {
        // Remove from local hand by finding matching instance
        for (var i = array_length(game.local_hand) - 1; i >= 0; i--) {
            if (game.local_hand[i].instance == card_instance) {
                show_debug_message("  Hand card removed: " + game.local_hand[i].id);
                array_delete(game.local_hand, i, 1);
                break;
            }
        }
    }));
}));

colyseus_on_remove(callbacks, "players", method(id, function(instance, key) {
    show_debug_message("Player removed: seat=" + key);
    if (variable_struct_exists(players, key)) {
        variable_struct_remove(players, key);
    }
}));

// =============================================================================
// Discard Pile (ArraySchema)
// =============================================================================

colyseus_on_add(callbacks, "discardPile", method(id, function(card_instance, card_key) {
    // Clear stale discard cards from previous game on first new card arrival
    if (restart_discard_clear_pending) {
        discard_pile = [];
        restart_discard_clear_pending = false;
    }

    var _id = colyseus_schema_get(card_instance, "id");
    var _card_type = colyseus_schema_get(card_instance, "cardType");
    var _color = colyseus_schema_get(card_instance, "color");
    var _value = colyseus_schema_get(card_instance, "value");
    var _chosen = colyseus_schema_get(card_instance, "chosenColor");
    if (is_undefined(_chosen)) _chosen = "";

    // Replace if duplicate ID exists
    for (var _di = array_length(discard_pile) - 1; _di >= 0; _di--) {
        if (discard_pile[_di].id == _id) {
            array_delete(discard_pile, _di, 1);
            break;
        }
    }

    var card = {
        id: _id,
        card_type: _card_type,
        color: _color,
        value: _value,
        chosen_color: _chosen,
        instance: card_instance
    };

    array_push(discard_pile, card);
    show_debug_message("Discard card added: " + _id);
}));

colyseus_on_remove(callbacks, "discardPile", method(id, function(card_instance, card_key) {
    for (var i = array_length(discard_pile) - 1; i >= 0; i--) {
        if (discard_pile[i].instance == card_instance) {
            show_debug_message("Discard card removed: " + discard_pile[i].id);
            array_delete(discard_pile, i, 1);
            break;
        }
    }
}));

show_debug_message("UNO state callbacks registered.");
