// =============================================================================
// obj_lobby - Create Event
// =============================================================================

// --- Global initialization ---
global.net_connected = false;
global.net_room = 0;
global.net_client = 0;
global.net_session_id = "";
global.net_room_id = "";

// --- Card sprite lookup map ---
// Maps texture_id (string) -> sprite index
// Using direct sprite constant references (compile-time resolved)
global.card_sprites = {};
global.card_sprites[$ "back"] = spr_card_back;
global.card_sprites[$ "red_0"] = spr_card_red_0;
global.card_sprites[$ "red_1"] = spr_card_red_1;
global.card_sprites[$ "red_2"] = spr_card_red_2;
global.card_sprites[$ "red_3"] = spr_card_red_3;
global.card_sprites[$ "red_4"] = spr_card_red_4;
global.card_sprites[$ "red_5"] = spr_card_red_5;
global.card_sprites[$ "red_6"] = spr_card_red_6;
global.card_sprites[$ "red_7"] = spr_card_red_7;
global.card_sprites[$ "red_8"] = spr_card_red_8;
global.card_sprites[$ "red_9"] = spr_card_red_9;
global.card_sprites[$ "red_skip"] = spr_card_red_skip;
global.card_sprites[$ "red_reverse"] = spr_card_red_reverse;
global.card_sprites[$ "red_draw2"] = spr_card_red_draw2;
global.card_sprites[$ "blue_0"] = spr_card_blue_0;
global.card_sprites[$ "blue_1"] = spr_card_blue_1;
global.card_sprites[$ "blue_2"] = spr_card_blue_2;
global.card_sprites[$ "blue_3"] = spr_card_blue_3;
global.card_sprites[$ "blue_4"] = spr_card_blue_4;
global.card_sprites[$ "blue_5"] = spr_card_blue_5;
global.card_sprites[$ "blue_6"] = spr_card_blue_6;
global.card_sprites[$ "blue_7"] = spr_card_blue_7;
global.card_sprites[$ "blue_8"] = spr_card_blue_8;
global.card_sprites[$ "blue_9"] = spr_card_blue_9;
global.card_sprites[$ "blue_skip"] = spr_card_blue_skip;
global.card_sprites[$ "blue_reverse"] = spr_card_blue_reverse;
global.card_sprites[$ "blue_draw2"] = spr_card_blue_draw2;
global.card_sprites[$ "green_0"] = spr_card_green_0;
global.card_sprites[$ "green_1"] = spr_card_green_1;
global.card_sprites[$ "green_2"] = spr_card_green_2;
global.card_sprites[$ "green_3"] = spr_card_green_3;
global.card_sprites[$ "green_4"] = spr_card_green_4;
global.card_sprites[$ "green_5"] = spr_card_green_5;
global.card_sprites[$ "green_6"] = spr_card_green_6;
global.card_sprites[$ "green_7"] = spr_card_green_7;
global.card_sprites[$ "green_8"] = spr_card_green_8;
global.card_sprites[$ "green_9"] = spr_card_green_9;
global.card_sprites[$ "green_skip"] = spr_card_green_skip;
global.card_sprites[$ "green_reverse"] = spr_card_green_reverse;
global.card_sprites[$ "green_draw2"] = spr_card_green_draw2;
global.card_sprites[$ "yellow_0"] = spr_card_yellow_0;
global.card_sprites[$ "yellow_1"] = spr_card_yellow_1;
global.card_sprites[$ "yellow_2"] = spr_card_yellow_2;
global.card_sprites[$ "yellow_3"] = spr_card_yellow_3;
global.card_sprites[$ "yellow_4"] = spr_card_yellow_4;
global.card_sprites[$ "yellow_5"] = spr_card_yellow_5;
global.card_sprites[$ "yellow_6"] = spr_card_yellow_6;
global.card_sprites[$ "yellow_7"] = spr_card_yellow_7;
global.card_sprites[$ "yellow_8"] = spr_card_yellow_8;
global.card_sprites[$ "yellow_9"] = spr_card_yellow_9;
global.card_sprites[$ "yellow_skip"] = spr_card_yellow_skip;
global.card_sprites[$ "yellow_reverse"] = spr_card_yellow_reverse;
global.card_sprites[$ "yellow_draw2"] = spr_card_yellow_draw2;
global.card_sprites[$ "wild"] = spr_card_wild;
global.card_sprites[$ "wild_draw4"] = spr_card_wild_draw4;

show_debug_message("Registered " + string(array_length(variable_struct_get_names(global.card_sprites))) + " card sprites");

// --- Input state ---
player_name = "";
room_code = "";
joining = false;
error_message = "";

// Which input field is focused: 0=name, 1=room code
focused_input = 0;

// UI animation
fade_alpha = 0;
hero_card_timer = 0;

// Button rects (populated in Draw)
btn_quick_x1 = 0; btn_quick_y1 = 0; btn_quick_x2 = 0; btn_quick_y2 = 0;
btn_join_x1 = 0; btn_join_y1 = 0; btn_join_x2 = 0; btn_join_y2 = 0;
name_input_x1 = 0; name_input_y1 = 0; name_input_x2 = 0; name_input_y2 = 0;
code_input_rect_x1 = 0; code_input_rect_y1 = 0; code_input_rect_x2 = 0; code_input_rect_y2 = 0;
