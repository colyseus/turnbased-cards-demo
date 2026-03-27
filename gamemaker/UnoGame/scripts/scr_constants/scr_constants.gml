// =============================================================================
// Game Constants — UNO Card Game
// =============================================================================

// Card dimensions (matching PNG assets: 240x375)
#macro CARD_WIDTH  240
#macro CARD_HEIGHT 375
#macro CARD_ASPECT 0.64   // 240/375

// Spring physics
#macro SPRING_STIFFNESS 200
#macro SPRING_DAMPING   30

// Turn indicator spring
#macro ARROW_STIFFNESS 120
#macro ARROW_DAMPING   22

// Timing (ms)
#macro SHOWCASE_DURATION_MS 700
#macro HUMAN_TURN_MS        7000
#macro BOT_TURN_MS          800

// Colors (GML format: make_color_rgb)
#macro CLR_TABLE_FELT    $3C7A1A    // #1a7a3c
#macro CLR_CARD_RED      $3333FF    // #ff3333
#macro CLR_CARD_BLUE     $FF7733    // #3377ff
#macro CLR_CARD_GREEN    $44BB33    // #33bb44
#macro CLR_CARD_YELLOW   $00CCFF    // #ffcc00
#macro CLR_HIGHLIGHT     $00CCFF    // #ffcc00
#macro CLR_ERROR_TEXT    $6B6BFF    // #ff6b6b
#macro CLR_BTN_BG        $00CCFF    // #ffcc00
#macro CLR_BTN_TEXT      $1A1A1A    // #1a1a1a
#macro CLR_LOBBY_CENTER  $458E1E    // #1e8e45
#macro CLR_LOBBY_MID     $305A14    // #145a30
#macro CLR_LOBBY_EDGE    $203D0D    // #0d3d20
#macro CLR_TIMER_GREEN   $44BB33    // #33bb44
#macro CLR_TIMER_YELLOW  $00CCFF    // #ffcc00
#macro CLR_TIMER_RED     $4444FF    // #ff4444

// Player visual positions
#macro VPOS_BOTTOM 0
#macro VPOS_LEFT   1
#macro VPOS_TOP    2
#macro VPOS_RIGHT  3

// Player angles for turn indicator (radians, screen-space: Y-down)
// bottom=PI/2, left=PI, top=-PI/2, right=0
#macro PLAYER_ANGLE_BOTTOM  1.5707963
#macro PLAYER_ANGLE_LEFT    3.1415926
#macro PLAYER_ANGLE_TOP    -1.5707963
#macro PLAYER_ANGLE_RIGHT   0

// Game phases
#macro PHASE_WAITING  "waiting"
#macro PHASE_PLAYING  "playing"
#macro PHASE_FINISHED "finished"
