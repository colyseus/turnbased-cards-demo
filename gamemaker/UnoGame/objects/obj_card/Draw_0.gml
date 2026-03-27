// =============================================================================
// obj_card - Draw Event
// =============================================================================

var draw_scale = cur_scale / CARD_HEIGHT;

// Determine which sprite to show based on flip
var show_back = (cur_flip > 0.5);

var spr;
if (show_back) {
    spr = get_card_sprite("back");
} else {
    spr = get_card_sprite(texture_id);
}

// Flip effect: compress X scale around the midpoint
var flip_factor = abs(cos(cur_flip * pi));
var sx = draw_scale * flip_factor;
var sy = draw_scale;

if (spr != -1 && sx > 0.001) {
    draw_sprite_ext(spr, 0, x, y, sx, sy, image_angle, image_blend, image_alpha);
}
