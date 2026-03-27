// =============================================================================
// obj_card - Create Event
// =============================================================================

// Card identity
card_id = "";
texture_id = "back";
card_sprite = -1;

// Spring physics state
target_x = x;
target_y = y;
target_rot = 0;       // degrees
target_scale = 1.0;
target_flip = 0;      // 0=face-up, 1=face-down

vel_x = 0;
vel_y = 0;
vel_rot = 0;
vel_scale = 0;
vel_flip = 0;

// Current flip state (0..1, used for face-up/down blending)
cur_flip = 0;

// Initial position (for entrance animation)
has_initial_pos = false;
initial_x = 0;
initial_y = 0;

// Shake
shake_enabled = false;
shake_time = 0;

// First frame flag
mounted = false;

// Scale storage
cur_scale = 1.0;
