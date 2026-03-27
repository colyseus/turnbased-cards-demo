// =============================================================================
// obj_card - Step Event (Spring Physics)
// =============================================================================

var dt = min(delta_time / 1000000, 0.05);

if (!mounted) {
    mounted = true;
    if (has_initial_pos) {
        x = initial_x;
        y = initial_y;
        cur_flip = 1; // Start face-down
    } else {
        x = target_x;
        y = target_y;
        cur_flip = target_flip;
    }
    image_angle = target_rot;
    cur_scale = target_scale;
    return;
}

// Position X spring
var rx = spring_step(x, target_x, vel_x, SPRING_STIFFNESS, SPRING_DAMPING, dt);
x = rx[0];
vel_x = rx[1];

// Position Y spring
var ry = spring_step(y, target_y, vel_y, SPRING_STIFFNESS, SPRING_DAMPING, dt);
y = ry[0];
vel_y = ry[1];

// Rotation spring (degrees)
var rr = spring_step(image_angle, target_rot, vel_rot, SPRING_STIFFNESS, SPRING_DAMPING, dt);
image_angle = rr[0];
vel_rot = rr[1];

// Shake wobble on top of rotation
if (shake_enabled) {
    shake_time += dt;
    image_angle += sin(shake_time * 22) * 3.5 + sin(shake_time * 37) * 1.7;
}

// Scale spring
var rs = spring_step(cur_scale, target_scale, vel_scale, SPRING_STIFFNESS, SPRING_DAMPING, dt);
cur_scale = rs[0];
vel_scale = rs[1];

// Flip spring (0=face-up, 1=face-down)
var rf = spring_step(cur_flip, target_flip, vel_flip, SPRING_STIFFNESS, SPRING_DAMPING, dt);
cur_flip = rf[0];
vel_flip = rf[1];
