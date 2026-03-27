// =============================================================================
// obj_game - Draw GUI Event (all rendering)
// =============================================================================

if (!variable_instance_exists(id, "layout")) exit;

var L = layout;
var gui_w = L.gui_w;
var gui_h = L.gui_h;
var cx = gui_w / 2;
var cy = gui_h / 2;

// =============================================================================
// 1. GREEN FELT BACKGROUND
// =============================================================================
draw_set_color(CLR_TABLE_FELT);
draw_rectangle(0, 0, gui_w, gui_h, false);

// Slight noise effect (draw a few subtle random lines for felt texture)
draw_set_alpha(0.02);
draw_set_color(c_white);
for (var i = 0; i < 100; i++) {
    var fx = irandom(gui_w);
    var fy = irandom(gui_h);
    var flen = 4 + irandom(8);
    var fang = pi * 0.25 + (random(1) - 0.5);
    draw_line(fx, fy, fx + cos(fang) * flen, fy + sin(fang) * flen);
}
draw_set_alpha(1);

// =============================================================================
// 2. CONNECTION STATUS
// =============================================================================
if (!global.net_connected) {
    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);
    draw_set_color(c_gray);
    draw_text(cx, cy, "Connecting...");
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_set_color(c_white);
    exit;
}

// =============================================================================
// 3. ACTIVE COLOR RING (below discard pile)
// =============================================================================
if (active_color != "") {
    var ring_cx = cx + L.pile_x;
    var ring_cy = cy;
    var outer_r = 0.62 * L.discard_scale * ring_scale;
    var inner_r = 0.55 * L.discard_scale * ring_scale * ring_inner_scale;

    draw_set_color(get_uno_color(active_color));
    draw_circle(ring_cx, ring_cy, outer_r, false);
    draw_set_color(CLR_TABLE_FELT);
    draw_circle(ring_cx, ring_cy, inner_r, false);
}

// =============================================================================
// 4–7. ALL CARDS (spring-animated from card_pool, sorted by z)
// =============================================================================
// Collect and sort pool entries by z
var _pool_keys = variable_struct_get_names(card_pool);
var _pool_count = array_length(_pool_keys);

// Simple insertion sort by z (stable, fast for ~30-50 cards)
var _sorted = array_create(_pool_count);
for (var i = 0; i < _pool_count; i++) _sorted[i] = _pool_keys[i];
for (var i = 1; i < _pool_count; i++) {
    var _k = _sorted[i];
    var _z = card_pool[$ _k].z;
    var j = i - 1;
    while (j >= 0 && card_pool[$ _sorted[j]].z > _z) {
        _sorted[j + 1] = _sorted[j];
        j--;
    }
    _sorted[j + 1] = _k;
}

// Draw each card
for (var i = 0; i < _pool_count; i++) {
    var _e = card_pool[$ _sorted[i]];

    // Flip effect: cf=0 → face-up, cf=1 → face-down
    var _show_back = (_e.cf > 0.5);
    var _spr = _show_back ? get_card_sprite("back") : get_card_sprite(_e.tex);
    if (_spr == -1) continue;

    var _flip_factor = abs(cos(_e.cf * pi));
    var _sx = _e.cs * _flip_factor;
    var _sy = _e.cs;
    if (_sx < 0.001) continue;

    // Shake wobble
    var _extra_rot = 0;
    if (_e.shake) {
        _extra_rot = sin(_e.shake_time * 22) * 3.5 + sin(_e.shake_time * 37) * 1.7;
    }

    draw_sprite_ext(_spr, 0, _e.cx, _e.cy, _sx, _sy, _e.cr + _extra_rot, _e.blend, 1);
}

// =============================================================================
// 8. TURN INDICATOR ARROW
// =============================================================================
if (winner == -1) {
    var arrow_radius = min(gui_h * 0.30, gui_w * 0.34);
    var arrow_size = arrow_radius * 0.14;

    // Main arrow (points toward current player)
    var ax = cx + cos(arrow_angle) * arrow_radius;
    var ay = cy + sin(arrow_angle) * arrow_radius;
    draw_triangle_at(ax, ay, arrow_size, arrow_angle, CLR_HIGHLIGHT, 1);

    // Direction arrows (4 small triangles showing play direction)
    for (var i = 0; i < 4; i++) {
        var base_angle = (i / 4) * 2 * pi + pi / 4 + dir_spin;
        var tangent = base_angle + (direction == 1 ? pi / 2 : -pi / 2);
        var dax = cx + cos(base_angle) * arrow_radius * 0.85;
        var day = cy + sin(base_angle) * arrow_radius * 0.85;
        draw_triangle_at(dax, day, arrow_size * 0.7, tangent, c_white, 0.5);
    }
}

// =============================================================================
// 9. COLOR PICKER OVERLAY
// =============================================================================
if (color_picker_for != "") {
    // Semi-transparent overlay
    draw_set_alpha(0.5);
    draw_set_color(c_black);
    draw_rectangle(0, 0, gui_w, gui_h, false);
    draw_set_alpha(1);

    var picker_radius = min(gui_w, gui_h) * 0.08;
    var circle_r = min(gui_w, gui_h) * 0.045;
    var picker_colors = ["red", "yellow", "green", "blue"];
    var picker_gml_colors = [CLR_CARD_RED, CLR_CARD_YELLOW, CLR_CARD_GREEN, CLR_CARD_BLUE];

    for (var i = 0; i < 4; i++) {
        var angle = (i / 4) * 2 * pi - pi / 4;
        var pcx = cx + cos(angle) * picker_radius;
        var pcy = cy + sin(angle) * picker_radius;
        var cr = circle_r;
        if (hovered_picker_color == picker_colors[i]) cr *= 1.3;

        draw_set_color(picker_gml_colors[i]);
        draw_circle(pcx, pcy, cr, false);

        // White border
        draw_set_color(c_white);
        draw_set_alpha(0.5);
        draw_circle(pcx, pcy, cr, true);
        draw_set_alpha(1);
    }
}

// =============================================================================
// 10. PLAYER LABELS (HUD)
// =============================================================================
draw_set_font(-1);
var player_keys = variable_struct_get_names(players);
for (var p_i = 0; p_i < array_length(player_keys); p_i++) {
    var pkey = player_keys[p_i];
    var p = players[$ pkey];
    var vis_pos = get_visual_position(p.seat_index, local_seat_index);
    var is_active = (current_player == p.seat_index && winner == -1);

    var label_x = 0;
    var label_y = 0;
    var h_align = fa_center;
    var v_align = fa_middle;

    switch (vis_pos) {
        case VPOS_BOTTOM:
            label_x = cx;
            label_y = gui_h - gui_h * 0.04;
            h_align = fa_center;
            break;
        case VPOS_LEFT:
            label_x = gui_w * 0.02;
            label_y = cy;
            h_align = fa_left;
            break;
        case VPOS_TOP:
            label_x = cx;
            label_y = gui_h * 0.04;
            h_align = fa_center;
            break;
        case VPOS_RIGHT:
            label_x = gui_w - gui_w * 0.02;
            label_y = cy;
            h_align = fa_right;
            break;
    }

    draw_set_halign(h_align);
    draw_set_valign(fa_middle);

    // Label color
    if (is_active) {
        draw_set_color(CLR_HIGHLIGHT);
    } else {
        draw_set_color(make_color_rgb(180, 180, 180));
    }

    // Player name
    var label_text = string_upper(p.name);
    draw_text(label_x, label_y, label_text);

    // Card count badge
    var badge_text = string(p.hand_count);
    var name_w = string_width(label_text);
    var badge_x = label_x;
    if (h_align == fa_center) badge_x = label_x + name_w / 2 + 16;
    else if (h_align == fa_left) badge_x = label_x + name_w + 16;
    else badge_x = label_x - 16;

    draw_set_alpha(0.4);
    draw_set_color(c_black);
    draw_roundrect(badge_x - 10, label_y - 8, badge_x + 10, label_y + 8, false);
    draw_set_alpha(1);
    draw_set_color(c_white);
    draw_set_halign(fa_center);
    draw_text(badge_x, label_y, badge_text);

    // Turn timer (circle progress indicator)
    if (is_active && turn_deadline > 0) {
        var timer_x = label_x;
        if (h_align == fa_center) timer_x = label_x - name_w / 2 - 16;
        else if (h_align == fa_left) timer_x = label_x - 16;
        else timer_x = label_x + 16;

        var timer_r = 8;
        var duration = p.is_bot ? BOT_TURN_MS : HUMAN_TURN_MS;
        var remaining = max(0, turn_deadline - current_time);
        var progress = clamp_val(remaining / duration, 0, 1);

        // Background ring
        draw_set_color(make_color_rgb(40, 40, 40));
        draw_set_alpha(0.3);
        draw_circle(timer_x, label_y, timer_r, true);
        draw_set_alpha(1);

        // Progress arc (approximated with a circle + color)
        if (progress > 0.5) draw_set_color(CLR_TIMER_GREEN);
        else if (progress > 0.2) draw_set_color(CLR_TIMER_YELLOW);
        else draw_set_color(CLR_TIMER_RED);

        // Draw progress arc as a partial circle
        if (progress > 0) {
            var arc_steps = 32;
            var arc_end = progress * 360;
            for (var a = 0; a < arc_end; a += (360 / arc_steps)) {
                var a1 = -90 + a;
                var a2 = -90 + min(a + (360 / arc_steps), arc_end);
                draw_line_width(
                    timer_x + dcos(a1) * timer_r, label_y - dsin(a1) * timer_r,
                    timer_x + dcos(a2) * timer_r, label_y - dsin(a2) * timer_r,
                    2
                );
            }
        }
    }
}

// =============================================================================
// 11. ROOM CODE (top-left)
// =============================================================================
if (global.net_room_id != "") {
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    if (copied_timer > 0) {
        draw_set_color(CLR_HIGHLIGHT);
        draw_text(12, 10, "Copied!");
    } else {
        draw_set_color(make_color_rgb(128, 128, 128));
        draw_text(12, 10, global.net_room_id);
    }
}

// =============================================================================
// 12. WINNER OVERLAY
// =============================================================================
if (winner != -1) {
    // Dim overlay
    draw_set_alpha(0.5);
    draw_set_color(c_black);
    draw_rectangle(0, 0, gui_w, gui_h, false);
    draw_set_alpha(1);

    // Find winner name
    var winner_name = "Player";
    var pkeys = variable_struct_get_names(players);
    for (var i = 0; i < array_length(pkeys); i++) {
        var p = players[$ pkeys[i]];
        if (p.seat_index == winner) {
            winner_name = p.name;
            break;
        }
    }

    // Winner text
    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);
    draw_set_color(CLR_HIGHLIGHT);
    draw_text_transformed(cx, cy - 20, string_upper(winner_name) + " WINS!", 2, 2, 0);

    // New Game button
    var btn_w = 200;
    var btn_h = 44;
    var btn_x = cx - btn_w / 2;
    var btn_y = cy + 30;
    draw_set_color(CLR_BTN_BG);
    draw_roundrect(btn_x, btn_y, btn_x + btn_w, btn_y + btn_h, false);
    draw_set_color(CLR_BTN_TEXT);
    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);
    draw_text(cx, btn_y + btn_h / 2, "NEW GAME");
}

// =============================================================================
// Reset draw state
// =============================================================================
draw_set_alpha(1);
draw_set_color(c_white);
draw_set_halign(fa_left);
draw_set_valign(fa_top);
