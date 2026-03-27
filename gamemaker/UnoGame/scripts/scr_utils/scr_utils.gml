// =============================================================================
// Utility Functions — UNO Card Game
// =============================================================================

/// @func get_visual_position(seat_index, local_seat_index)
/// @desc Compute visual position (0=bottom, 1=left, 2=top, 3=right)
function get_visual_position(seat_index, local_seat_index) {
    return ((seat_index - local_seat_index) + 4) mod 4;
}

/// @func hash_rotation(card_id, index)
/// @desc Deterministic rotation for discard pile scatter (±20 degrees)
function hash_rotation(card_id, index) {
    var h = index * 7;
    for (var i = 1; i <= string_length(card_id); i++) {
        h = (h * 31 + ord(string_char_at(card_id, i)));
        // Keep in 32-bit range to avoid overflow
        h = h & $7FFFFFFF;
    }
    return ((h mod 40) - 20) * (pi / 180);
}

/// @func card_texture_from_schema(card_type, color, value)
/// @desc Get sprite name from schema card data
function card_texture_from_schema(card_type, color, value) {
    if (card_type == "wild") return value; // "wild" or "wild_draw4"
    return color + "_" + value;            // e.g. "red_5"
}

/// @func can_play_card(card_type, card_color, card_value, top_card_type, top_card_value, active_color)
/// @desc Check if a card can be played on the discard pile
function can_play_card(card_type, card_color, card_value, top_card_type, top_card_value, active_color) {
    if (card_type == "wild") return true;
    if (card_color == active_color) return true;
    if (top_card_type == "color" && card_value == top_card_value) return true;
    return false;
}

/// @func get_player_angle(visual_pos)
/// @desc Get angle in radians for a visual position
function get_player_angle(visual_pos) {
    switch (visual_pos) {
        case 0: return PLAYER_ANGLE_BOTTOM;
        case 1: return PLAYER_ANGLE_LEFT;
        case 2: return PLAYER_ANGLE_TOP;
        case 3: return PLAYER_ANGLE_RIGHT;
    }
    return PLAYER_ANGLE_BOTTOM;
}

/// @func get_uno_color(color_name)
/// @desc Convert color name string to GML color
function get_uno_color(color_name) {
    switch (color_name) {
        case "red":    return CLR_CARD_RED;
        case "blue":   return CLR_CARD_BLUE;
        case "green":  return CLR_CARD_GREEN;
        case "yellow": return CLR_CARD_YELLOW;
    }
    return c_white;
}

/// @func spring_step(current, target, velocity, stiffness, damping, dt)
/// @desc Compute one spring physics step, returns [new_current, new_velocity]
function spring_step(current, target, velocity, stiffness, damping, dt) {
    var acc = stiffness * (target - current) - damping * velocity;
    var new_vel = velocity + acc * dt;
    var new_cur = current + new_vel * dt;
    return [new_cur, new_vel];
}

/// @func get_card_sprite(texture_id)
/// @desc Look up the sprite index from global.card_sprites map
function get_card_sprite(texture_id) {
    if (variable_struct_exists(global.card_sprites, texture_id)) {
        return global.card_sprites[$ texture_id];
    }
    // Fallback to back
    if (variable_struct_exists(global.card_sprites, "back")) {
        return global.card_sprites[$ "back"];
    }
    return -1;
}

/// @func clamp_val(val, lo, hi)
/// @desc Clamp a value between lo and hi
function clamp_val(val, lo, hi) {
    return min(hi, max(lo, val));
}

/// @func draw_triangle_at(cx, cy, size, angle, color, alpha)
/// @desc Draw a triangle arrow at position with rotation
function draw_triangle_at(cx, cy, size, angle, col, alpha) {
    var ca = cos(angle);
    var sa = sin(angle);
    // Triangle points: tip, left, right
    var x1 = cx + ca * size;
    var y1 = cy + sa * size;
    var x2 = cx + cos(angle + 2.618) * size * 0.6; // ~150 degrees
    var y2 = cy + sin(angle + 2.618) * size * 0.6;
    var x3 = cx + cos(angle - 2.618) * size * 0.6;
    var y3 = cy + sin(angle - 2.618) * size * 0.6;
    draw_set_alpha(alpha);
    draw_set_color(col);
    draw_triangle(x1, y1, x2, y2, x3, y3, false);
    draw_set_alpha(1);
}
