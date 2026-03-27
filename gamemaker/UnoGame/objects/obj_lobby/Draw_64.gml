// =============================================================================
// obj_lobby - Draw Event (Draw GUI)
// =============================================================================

var gui_w = display_get_gui_width();
var gui_h = display_get_gui_height();
var cx = gui_w / 2;
var cy = gui_h / 2;

// --- Green gradient background ---
draw_set_alpha(1);
draw_set_color(CLR_LOBBY_EDGE);
draw_rectangle(0, 0, gui_w, gui_h, false);

// Radial-ish gradient using concentric rectangles
var steps = 20;
for (var i = steps; i >= 0; i--) {
    var t = i / steps;
    var r = lerp(color_get_red(CLR_LOBBY_CENTER), color_get_red(CLR_LOBBY_EDGE), t);
    var g = lerp(color_get_green(CLR_LOBBY_CENTER), color_get_green(CLR_LOBBY_EDGE), t);
    var b = lerp(color_get_blue(CLR_LOBBY_CENTER), color_get_blue(CLR_LOBBY_EDGE), t);
    draw_set_color(make_color_rgb(r, g, b));
    var margin = t * min(gui_w, gui_h) * 0.5;
    draw_rectangle(margin, margin, gui_w - margin, gui_h - margin, false);
}

// --- Fade-in ---
fade_alpha = min(1, fade_alpha + 0.03);
draw_set_alpha(fade_alpha);

// --- Title ---
draw_set_halign(fa_center);
draw_set_valign(fa_middle);
draw_set_color(CLR_HIGHLIGHT);
draw_set_font(-1);
draw_text_transformed(cx, cy - 180, "CARD GAME", 3, 3, 0);

// --- Hero card (wild_draw4) to the right of title ---
hero_card_timer += delta_time / 1000000;
var hero_bob = sin(hero_card_timer * 2.094) * 6; // 3s cycle, 6px bob
var hero_spr = get_card_sprite("wild_draw4");
if (hero_spr != -1) {
    var hero_scale = 0.35;
    draw_sprite_ext(hero_spr, 0, cx + 180, cy - 180 + hero_bob, hero_scale, hero_scale, 12 + sin(hero_card_timer * 2.094) * 2, c_white, fade_alpha);
}

// --- Subtitle ---
draw_set_color(make_color_rgb(128, 128, 128));
draw_set_halign(fa_center);
draw_text_transformed(cx, cy - 140, "COLYSEUS DEMO", 1.2, 1.2, 0);

// --- Name input field ---
var input_w = 260;
var input_h = 36;
var input_x = cx - input_w / 2;
var input_y = cy - 80;

// Background
draw_set_alpha(fade_alpha * 0.3);
draw_set_color(c_black);
draw_roundrect(input_x, input_y, input_x + input_w, input_y + input_h, false);

// Border
draw_set_alpha(fade_alpha);
draw_set_color(focused_input == 0 ? CLR_HIGHLIGHT : c_white);
draw_roundrect(input_x, input_y, input_x + input_w, input_y + input_h, true);

// Text
draw_set_color(c_white);
draw_set_halign(fa_center);
draw_set_valign(fa_middle);
var display_name = (player_name == "" && focused_input != 0) ? "Enter your name..." : player_name;
if (player_name == "" && focused_input == 0) {
    display_name = player_name;
    // Show cursor blinking
    if ((current_time div 500) mod 2 == 0) display_name += "|";
}
if (player_name != "") display_name = player_name;
if (player_name == "" && focused_input == 0) {
    draw_set_color(make_color_rgb(128, 128, 128));
    draw_text(cx, input_y + input_h / 2, "Enter your name...");
    draw_set_color(c_white);
    // Cursor
    if ((current_time div 500) mod 2 == 0) {
        draw_text(cx, input_y + input_h / 2, "|");
    }
} else if (player_name == "") {
    draw_set_color(make_color_rgb(128, 128, 128));
    draw_text(cx, input_y + input_h / 2, "Enter your name...");
} else {
    draw_text(cx, input_y + input_h / 2, player_name);
    if (focused_input == 0 && (current_time div 500) mod 2 == 0) {
        var tw = string_width(player_name);
        draw_text(cx + tw / 2, input_y + input_h / 2, "|");
    }
}

// --- Quick Play button ---
var btn_y = cy - 30;
var btn_alpha = joining ? 0.5 : 1.0;
draw_set_alpha(fade_alpha * btn_alpha);
draw_set_color(CLR_BTN_BG);
draw_roundrect(input_x, btn_y, input_x + input_w, btn_y + 40, false);
draw_set_color(CLR_BTN_TEXT);
draw_set_halign(fa_center);
draw_text(cx, btn_y + 20, joining ? "JOINING..." : "QUICK PLAY");

// Store button rect for click detection
btn_quick_x1 = input_x;
btn_quick_y1 = btn_y;
btn_quick_x2 = input_x + input_w;
btn_quick_y2 = btn_y + 40;

// --- Divider ---
draw_set_alpha(fade_alpha * 0.35);
draw_set_color(c_white);
draw_set_halign(fa_center);
draw_text(cx, cy + 30, "OR JOIN BY CODE");

// --- Room code input ---
var code_input_w = 160;
var code_input_x = cx - 130;
var code_input_y = cy + 55;
var code_h = 36;

// Background
draw_set_alpha(fade_alpha * 0.3);
draw_set_color(c_black);
draw_roundrect(code_input_x, code_input_y, code_input_x + code_input_w, code_input_y + code_h, false);

// Border
draw_set_alpha(fade_alpha);
draw_set_color(focused_input == 1 ? CLR_HIGHLIGHT : c_white);
draw_roundrect(code_input_x, code_input_y, code_input_x + code_input_w, code_input_y + code_h, true);

// Text
draw_set_color(c_white);
draw_set_halign(fa_center);
if (room_code == "") {
    draw_set_color(make_color_rgb(128, 128, 128));
    draw_text(code_input_x + code_input_w / 2, code_input_y + code_h / 2, "Room code...");
} else {
    draw_text(code_input_x + code_input_w / 2, code_input_y + code_h / 2, room_code);
}

// Store input rects for click detection
code_input_rect_x1 = code_input_x;
code_input_rect_y1 = code_input_y;
code_input_rect_x2 = code_input_x + code_input_w;
code_input_rect_y2 = code_input_y + code_h;

// --- Join button ---
var join_btn_x = cx + 40;
var join_btn_w = 90;
var join_disabled = (room_code == "") || joining;
var join_alpha = join_disabled ? 0.5 : 1.0;
draw_set_alpha(fade_alpha * join_alpha);
draw_set_color(CLR_BTN_BG);
draw_roundrect(join_btn_x, code_input_y, join_btn_x + join_btn_w, code_input_y + code_h, false);
draw_set_color(CLR_BTN_TEXT);
draw_set_halign(fa_center);
draw_text(join_btn_x + join_btn_w / 2, code_input_y + code_h / 2, "JOIN");

btn_join_x1 = join_btn_x;
btn_join_y1 = code_input_y;
btn_join_x2 = join_btn_x + join_btn_w;
btn_join_y2 = code_input_y + code_h;

// --- Error text ---
if (error_message != "") {
    draw_set_alpha(fade_alpha);
    draw_set_color(CLR_ERROR_TEXT);
    draw_set_halign(fa_center);
    draw_text(cx, cy + 110, error_message);
}

// --- Name input rect for click detection ---
name_input_x1 = input_x;
name_input_y1 = input_y;
name_input_x2 = input_x + input_w;
name_input_y2 = input_y + input_h;

// Reset draw state
draw_set_alpha(1);
draw_set_color(c_white);
draw_set_halign(fa_left);
draw_set_valign(fa_top);
