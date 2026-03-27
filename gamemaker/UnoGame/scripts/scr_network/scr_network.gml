// =============================================================================
// Network — Colyseus SDK Integration for UNO
// =============================================================================

/// @func network_send_play_card(card_id, chosen_color)
/// @desc Send a play_card message to the server
function network_send_play_card(card_id, chosen_color) {
    if (!global.net_connected) return;
    var data = { cardId: card_id };
    if (chosen_color != "") {
        data.chosenColor = chosen_color;
    }
    colyseus_send(global.net_room, "play_card", data);
}

/// @func network_send_draw_card()
/// @desc Send a draw_card message to the server (no payload)
function network_send_draw_card() {
    if (!global.net_connected) return;
    // Send empty map — server expects no data
    colyseus_send(global.net_room, "draw_card", "");
}

/// @func network_send_restart()
/// @desc Send a restart message to the server
function network_send_restart() {
    if (!global.net_connected) return;
    colyseus_send(global.net_room, "restart", "");
}
