// =============================================================================
// obj_game - Step Event
// =============================================================================

// --- Process Colyseus events (REQUIRED every frame) ---
colyseus_process();

var dt = min(delta_time / 1000000, 0.05); // seconds, clamped
var gui_w = display_get_gui_width();
var gui_h = display_get_gui_height();

// --- Shake timer ---
shake_time += dt;

// --- Layout computation ---
var portrait = (gui_w < gui_h);
var unit = min(gui_w, gui_h);

var player_scale   = portrait ? gui_w * 0.18 : unit * 0.15;
var player_spacing = player_scale * (portrait ? 0.35 : 0.42);
var player_hover_scale = player_scale * 1.12;
var hover_lift     = player_scale * 0.35;
var bottom_y       = gui_h * 0.82;

var opponent_scale = portrait ? gui_w * 0.09 : unit * 0.08;
var h_spacing      = opponent_scale * 0.40;
var v_spacing      = opponent_scale * 0.40;
var top_y          = gui_h * 0.12;
var side_x         = clamp_val(gui_w * 0.42, unit * 0.25, gui_w * 0.47);
var side_y_offset  = gui_h * 0.47;

var pile_x         = clamp_val(unit * 0.08, 30, 100);
var pile_scale     = portrait ? gui_w * 0.10 : unit * 0.08;
var discard_scale  = portrait ? gui_w * 0.12 : unit * 0.10;
var showcase_scale = portrait ? gui_w * 0.30 : unit * 0.22;

// Store layout for Draw event
layout = {
    portrait: portrait,
    unit: unit,
    player_scale: player_scale,
    player_spacing: player_spacing,
    player_hover_scale: player_hover_scale,
    hover_lift: hover_lift,
    bottom_y: bottom_y,
    opponent_scale: opponent_scale,
    h_spacing: h_spacing,
    v_spacing: v_spacing,
    top_y: top_y,
    side_x: side_x,
    side_y_offset: side_y_offset,
    pile_x: pile_x,
    pile_scale: pile_scale,
    discard_scale: discard_scale,
    showcase_scale: showcase_scale,
    gui_w: gui_w,
    gui_h: gui_h
};

// --- Showcase timer ---
if (showcase_card_id != "") {
    showcase_timer -= delta_time / 1000; // ms
    if (showcase_timer <= 0) {
        showcase_card_id = "";
        showcase_timer = 0;
    }
}

// --- Turn indicator spring physics ---
if (phase == PHASE_PLAYING) {
    var current_vis_pos = get_visual_position(current_player, local_seat_index);
    var new_target = get_player_angle(current_vis_pos);

    // Compute shortest-path diff from current angle to new target
    var diff = new_target - arrow_angle;
    while (diff > pi) diff -= 2 * pi;
    while (diff < -pi) diff += 2 * pi;
    // If same position, do a full spin in play direction
    if (abs(diff) < 0.01 && abs(arrow_vel) < 0.1 && abs(new_target - prev_arrow_target) > 0.01) {
        diff = direction * 2 * pi;
    }
    arrow_target = arrow_angle + diff;
    prev_arrow_target = new_target;

    var result = spring_step(arrow_angle, arrow_target, arrow_vel, ARROW_STIFFNESS, ARROW_DAMPING, dt);
    arrow_angle = result[0];
    arrow_vel = result[1];

    // Direction arrows spin (screen-space: Y-down, so CW = positive angle)
    dir_spin += (direction == 1 ? 0.1 : -0.1) * dt;
}

// --- Active color ring spring ---
var ring_result = spring_step(ring_scale, 1, ring_scale_vel, SPRING_STIFFNESS, SPRING_DAMPING, dt);
ring_scale = ring_result[0];
ring_scale_vel = ring_result[1];

var ring_inner_result = spring_step(ring_inner_scale, 1, ring_inner_vel, SPRING_STIFFNESS, SPRING_DAMPING, dt);
ring_inner_scale = ring_inner_result[0];
ring_inner_vel = ring_inner_result[1];

// --- Playable set computation ---
var is_my_turn = (current_player == local_seat_index);
var playable_set = {};

if (is_my_turn && winner == -1 && pending_draw == 0
    && showcase_card_id == "" && color_picker_for == ""
    && array_length(discard_pile) > 0) {
    var top_card = discard_pile[array_length(discard_pile) - 1];
    for (var i = 0; i < array_length(local_hand); i++) {
        var c = local_hand[i];
        if (can_play_card(c.card_type, c.color, c.value, top_card.card_type, top_card.value, active_color)) {
            playable_set[$ c.id] = true;
        }
    }
}

// Store for Draw event
global_playable_set = playable_set;

// --- Card click / hover detection (uses card_pool animated positions) ---
var _hit_h = player_scale * 1.1;
var _hit_w = max(player_spacing, player_scale * 0.5) * 1.2;

if (mouse_check_button_pressed(mb_left) && is_my_turn && winner == -1 && showcase_card_id == "" && color_picker_for == "") {
    var mx = device_mouse_x_to_gui(0);
    var my = device_mouse_y_to_gui(0);

    // Check local hand cards in reverse z-order (highest z first)
    var _clicked = "";
    var _clicked_z = -1;
    for (var i = 0; i < array_length(local_hand); i++) {
        var card = local_hand[i];
        var _k = card.id;
        if (!variable_struct_exists(card_pool, _k)) continue;
        var _e = card_pool[$ _k];
        if (point_in_rectangle(mx, my, _e.cx - _hit_w / 2, _e.cy - _hit_h / 2, _e.cx + _hit_w / 2, _e.cy + _hit_h / 2)) {
            if (_e.z > _clicked_z) { _clicked = _k; _clicked_z = _e.z; }
        }
    }
    if (_clicked != "") {
        if (variable_struct_exists(playable_set, _clicked)) {
            // Find card data
            var _card_data = undefined;
            for (var i = 0; i < array_length(local_hand); i++) {
                if (local_hand[i].id == _clicked) { _card_data = local_hand[i]; break; }
            }
            if (!is_undefined(_card_data)) {
                if (_card_data.card_type == "wild") {
                    color_picker_for = _clicked;
                } else {
                    network_send_play_card(_clicked, "");
                    hovered_card = "";
                    showcase_card_id = _clicked;
                    showcase_timer = SHOWCASE_DURATION_MS;
                }
            }
        }
    }
}

// --- Color picker click detection ---
if (color_picker_for != "" && mouse_check_button_pressed(mb_left)) {
    var mx = device_mouse_x_to_gui(0);
    var my = device_mouse_y_to_gui(0);
    var picker_cx = gui_w / 2;
    var picker_cy = gui_h / 2;
    var picker_radius = min(gui_w, gui_h) * 0.08;
    var circle_r = min(gui_w, gui_h) * 0.045;

    var picker_colors = ["red", "yellow", "green", "blue"];
    for (var i = 0; i < 4; i++) {
        var angle = (i / 4) * 2 * pi - pi / 4;
        var pcx = picker_cx + cos(angle) * picker_radius;
        var pcy = picker_cy + sin(angle) * picker_radius;
        var dist = point_distance(mx, my, pcx, pcy);
        if (dist <= circle_r * 1.3) {
            network_send_play_card(color_picker_for, picker_colors[i]);
            showcase_card_id = color_picker_for;
            showcase_timer = SHOWCASE_DURATION_MS;
            color_picker_for = "";
            hovered_card = "";
            hovered_picker_color = "";
            break;
        }
    }
}

// --- Color picker hover detection ---
if (color_picker_for != "") {
    var mx = device_mouse_x_to_gui(0);
    var my = device_mouse_y_to_gui(0);
    var picker_cx = gui_w / 2;
    var picker_cy = gui_h / 2;
    var picker_radius = min(gui_w, gui_h) * 0.08;
    var circle_r = min(gui_w, gui_h) * 0.045;

    hovered_picker_color = "";
    var picker_colors = ["red", "yellow", "green", "blue"];
    for (var i = 0; i < 4; i++) {
        var angle = (i / 4) * 2 * pi - pi / 4;
        var pcx = picker_cx + cos(angle) * picker_radius;
        var pcy = picker_cy + sin(angle) * picker_radius;
        var dist = point_distance(mx, my, pcx, pcy);
        if (dist <= circle_r * 1.3) {
            hovered_picker_color = picker_colors[i];
            break;
        }
    }
}

// --- Hand card hover detection (uses card_pool positions) ---
if (is_my_turn && winner == -1 && showcase_card_id == "" && color_picker_for == "") {
    var mx = device_mouse_x_to_gui(0);
    var my = device_mouse_y_to_gui(0);

    hovered_card = "";
    var _hov_z = -1;
    for (var i = 0; i < array_length(local_hand); i++) {
        var card = local_hand[i];
        if (!variable_struct_exists(playable_set, card.id)) continue;
        var _k = card.id;
        if (!variable_struct_exists(card_pool, _k)) continue;
        var _e = card_pool[$ _k];
        if (point_in_rectangle(mx, my, _e.cx - _hit_w / 2, _e.cy - _hit_h / 2, _e.cx + _hit_w / 2, _e.cy + _hit_h / 2)) {
            if (_e.z > _hov_z) { hovered_card = _k; _hov_z = _e.z; }
        }
    }
}


// =============================================================================
// CARD POOL — build target renders, detect entrances, sync pool, spring update
// =============================================================================
var _cx = gui_w / 2;
var _cy = gui_h / 2;
var _renders = {};          // key -> render struct
var _render_keys = [];      // for iteration
var _placed = {};           // card id -> true (avoid duplicates)
var _draw_origin_x = _cx - pile_x;
var _draw_origin_y = _cy;
var discard_len = array_length(discard_pile);

// Helper: opponent hand center position for a visual position
var _hand_cx = function(_vp, _g_cx, _g_cy, _L) {
    switch (_vp) {
        case VPOS_LEFT:   return [_L.gui_w * 0.06, _g_cy];
        case VPOS_TOP:    return [_g_cx, _L.gui_h * 0.08];
        case VPOS_RIGHT:  return [_L.gui_w * 0.94, _g_cy];
        default:          return [_g_cx, _L.bottom_y];
    }
};

// --- Detect new cards for entrance animation ---
var _new_origins = {};  // key -> [ix, iy]

// New discard from opponent
if (discard_len > prev_discard_len && prev_current_player >= 0) {
    var _nc = discard_pile[discard_len - 1];
    var _fvp = get_visual_position(prev_current_player, local_seat_index);
    if (_fvp != 0) {
        var _hc = _hand_cx(_fvp, _cx, _cy, layout);
        _new_origins[$ _nc.id] = _hc;
    }
}

// New opponent hand cards from draw pile
var player_keys = variable_struct_get_names(players);
for (var i = 0; i < array_length(player_keys); i++) {
    var pkey = player_keys[i];
    var p = players[$ pkey];
    var _vp = get_visual_position(p.seat_index, local_seat_index);
    if (_vp == 0) continue;
    var _pc = variable_struct_exists(prev_hand_counts, pkey) ? prev_hand_counts[$ pkey] : 0;
    if (p.hand_count > _pc) {
        for (var j = _pc; j < p.hand_count; j++) {
            _new_origins[$ "op-" + pkey + "-" + string(j)] = [_draw_origin_x, _draw_origin_y];
        }
    }
}

// New local hand cards from draw pile
for (var i = 0; i < array_length(local_hand); i++) {
    var _cid = local_hand[i].id;
    if (!variable_struct_exists(prev_local_hand_ids, _cid)) {
        _new_origins[$ _cid] = [_draw_origin_x, _draw_origin_y];
    }
}

// Update prev tracking
prev_discard_len = discard_len;
for (var i = 0; i < array_length(player_keys); i++) {
    var pkey = player_keys[i];
    prev_hand_counts[$ pkey] = players[$ pkey].hand_count;
}
prev_local_hand_ids = {};
for (var i = 0; i < array_length(local_hand); i++) {
    prev_local_hand_ids[$ local_hand[i].id] = true;
}

// --- Build render targets ---

// 1) Showcase card
if (showcase_card_id != "") {
    var _sc = undefined;
    for (var i = 0; i < array_length(local_hand); i++) {
        if (local_hand[i].id == showcase_card_id) { _sc = local_hand[i]; break; }
    }
    if (is_undefined(_sc)) {
        for (var i = 0; i < discard_len; i++) {
            if (discard_pile[i].id == showcase_card_id) { _sc = discard_pile[i]; break; }
        }
    }
    if (!is_undefined(_sc)) {
        _placed[$ _sc.id] = true;
        var _k = _sc.id;
        _renders[$ _k] = { tx: _cx, ty: _cy * 0.8, tr: 0, ts: showcase_scale / CARD_HEIGHT, tf: 0, z: 200, tex: card_texture_from_schema(_sc.card_type, _sc.color, _sc.value), blend: c_white, shake: false };
        array_push(_render_keys, _k);
    }
}

// 2) Discard pile
for (var i = 0; i < discard_len; i++) {
    var card = discard_pile[i];
    if (variable_struct_exists(_placed, card.id)) continue;
    _placed[$ card.id] = true;
    var _k = card.id;
    var _sx = ((i * 13) mod 7 - 3) * 0.3;
    var _sy = ((i * 7) mod 5 - 2) * 0.3;
    _renders[$ _k] = { tx: _cx + pile_x + _sx, ty: _cy + _sy, tr: radtodeg(hash_rotation(card.id, i)), ts: discard_scale / CARD_HEIGHT, tf: 0, z: 50 + i, tex: card_texture_from_schema(card.card_type, card.color, card.value), blend: c_white, shake: false };
    array_push(_render_keys, _k);
}

// 3) Local player hand — collect unique visible cards, then position
var _hand_visible = [];  // array of card structs (deduplicated, non-placed)
var _hand_seen = {};     // track IDs already collected
for (var i = 0; i < array_length(local_hand); i++) {
    var card = local_hand[i];
    if (variable_struct_exists(_placed, card.id)) continue;
    if (variable_struct_exists(_hand_seen, card.id)) continue;
    _hand_seen[$ card.id] = true;
    array_push(_hand_visible, card);
}
var _vis_hand_len = array_length(_hand_visible);
for (var _vi = 0; _vi < _vis_hand_len; _vi++) {
    var card = _hand_visible[_vi];
    _placed[$ card.id] = true;
    var _k = card.id;
    var center = _vi - (_vis_hand_len - 1) / 2;
    var _playable = variable_struct_exists(playable_set, card.id);
    var _hov = (_playable && card.id == hovered_card);
    var _cm = (hovered_picker_color != "" && card.card_type == "color" && card.color == hovered_picker_color);
    var _lift = 0;
    if (_cm) _lift = hover_lift * 0.5;
    else if (_playable) _lift = hover_lift * 0.35;
    var _card_y = bottom_y - abs(center) * 0.5;
    if (_hov) _card_y -= hover_lift; else _card_y -= _lift;
    var _sc = _hov ? player_hover_scale : player_scale;
    _renders[$ _k] = { tx: _cx + center * player_spacing, ty: _card_y, tr: -center * 1.7, ts: _sc / CARD_HEIGHT, tf: 0, z: 10 + _vi + (_hov ? 5 : 0), tex: card_texture_from_schema(card.card_type, card.color, card.value), blend: _playable ? c_white : make_color_rgb(180, 180, 180), shake: (_vis_hand_len == 1 && winner == -1) };
    array_push(_render_keys, _k);
}

// 4) Opponent hands (face-down)
for (var i = 0; i < array_length(player_keys); i++) {
    var pkey = player_keys[i];
    var p = players[$ pkey];
    var _vp = get_visual_position(p.seat_index, local_seat_index);
    if (_vp == 0) continue;
    var _hc = p.hand_count;
    for (var ci = 0; ci < _hc; ci++) {
        var center = ci - (_hc - 1) / 2;
        var _k = "op-" + pkey + "-" + string(ci);
        var _card_x = 0, _card_y = 0, _card_rot = 0;
        switch (_vp) {
            case VPOS_LEFT:
                _card_x = gui_w * 0.06; _card_y = _cy + center * v_spacing; _card_rot = 90; break;
            case VPOS_TOP:
                _card_x = _cx + center * h_spacing; _card_y = gui_h * 0.08; _card_rot = 0; break;
            case VPOS_RIGHT:
                _card_x = gui_w * 0.94; _card_y = _cy + center * v_spacing; _card_rot = -90; break;
        }
        _renders[$ _k] = { tx: _card_x, ty: _card_y, tr: _card_rot, ts: opponent_scale / CARD_HEIGHT, tf: 1, z: ci, tex: "back", blend: c_white, shake: (_hc == 1 && winner == -1) };
        array_push(_render_keys, _k);
    }
}

// 5) Draw pile (face-down stacked)
var _vis_draw = min(draw_pile_count, 8);
for (var i = 0; i < _vis_draw; i++) {
    var _k = "draw-" + string(i);
    var _dt = (_vis_draw > 1) ? (_vis_draw - 1 - i) / (_vis_draw - 1) : 0;
    _renders[$ _k] = { tx: _cx - pile_x + _dt * pile_scale * 0.04, ty: _cy - _dt * pile_scale * 0.08, tr: 0, ts: pile_scale / CARD_HEIGHT, tf: 1, z: i, tex: "back", blend: c_white, shake: false };
    array_push(_render_keys, _k);
}

// --- Sync card_pool with renders ---
// Remove cards no longer in renders
var _pool_keys = variable_struct_get_names(card_pool);
for (var i = 0; i < array_length(_pool_keys); i++) {
    if (!variable_struct_exists(_renders, _pool_keys[i])) {
        variable_struct_remove(card_pool, _pool_keys[i]);
    }
}

// Create or update pool entries
for (var i = 0; i < array_length(_render_keys); i++) {
    var _k = _render_keys[i];
    var _r = _renders[$ _k];
    if (!variable_struct_exists(card_pool, _k)) {
        // New card — start at initial position or target
        var _sx = _r.tx, _sy = _r.ty;
        if (variable_struct_exists(_new_origins, _k)) {
            var _o = _new_origins[$ _k];
            _sx = _o[0]; _sy = _o[1];
        }
        card_pool[$ _k] = { cx: _sx, cy: _sy, cr: _r.tr, cs: _r.ts, cf: _r.tf, vx: 0, vy: 0, vr: 0, vs: 0, vf: 0, tex: _r.tex, z: _r.z, blend: _r.blend, shake: _r.shake, shake_time: 0 };
    } else {
        // Existing card — update render info (targets applied via spring below)
        var _e = card_pool[$ _k];
        _e.tex = _r.tex;
        _e.z = _r.z;
        _e.blend = _r.blend;
        _e.shake = _r.shake;
    }
    // Apply targets + spring
    var _e = card_pool[$ _k];
    var _rx = spring_step(_e.cx, _r.tx, _e.vx, SPRING_STIFFNESS, SPRING_DAMPING, dt);
    _e.cx = _rx[0]; _e.vx = _rx[1];
    var _ry = spring_step(_e.cy, _r.ty, _e.vy, SPRING_STIFFNESS, SPRING_DAMPING, dt);
    _e.cy = _ry[0]; _e.vy = _ry[1];
    var _rr = spring_step(_e.cr, _r.tr, _e.vr, SPRING_STIFFNESS, SPRING_DAMPING, dt);
    _e.cr = _rr[0]; _e.vr = _rr[1];
    var _rs = spring_step(_e.cs, _r.ts, _e.vs, SPRING_STIFFNESS, SPRING_DAMPING, dt);
    _e.cs = _rs[0]; _e.vs = _rs[1];
    var _rf = spring_step(_e.cf, _r.tf, _e.vf, SPRING_STIFFNESS, SPRING_DAMPING, dt);
    _e.cf = _rf[0]; _e.vf = _rf[1];
    if (_e.shake) _e.shake_time += dt; else _e.shake_time = 0;
}

// --- Winner overlay: New Game button click ---
if (winner != -1 && mouse_check_button_pressed(mb_left)) {
    var mx = device_mouse_x_to_gui(0);
    var my = device_mouse_y_to_gui(0);
    var btn_w = 200;
    var btn_h = 44;
    var btn_x = gui_w / 2 - btn_w / 2;
    var btn_y = gui_h / 2 + 30;
    if (point_in_rectangle(mx, my, btn_x, btn_y, btn_x + btn_w, btn_y + btn_h)) {
        network_send_restart();
    }
}

// --- Room code click to copy ---
if (mouse_check_button_pressed(mb_left) && global.net_room_id != "") {
    var mx = device_mouse_x_to_gui(0);
    var my = device_mouse_y_to_gui(0);
    if (point_in_rectangle(mx, my, 10, 8, 160, 28)) {
        // Copy to clipboard (GML)
        clipboard_set_text(global.net_room_id);
        copied_timer = 1500;
    }
}
if (copied_timer > 0) {
    copied_timer -= delta_time / 1000;
}
