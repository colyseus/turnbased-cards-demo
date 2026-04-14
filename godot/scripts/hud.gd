extends CanvasLayer

## HUD overlay — player labels, room code, turn timer, winner overlay.

const COLOR_HEX := {
	"red": Color(1.0, 0.2, 0.2),
	"blue": Color(0.2, 0.467, 1.0),
	"green": Color(0.2, 0.733, 0.267),
	"yellow": Color(1.0, 0.8, 0.0),
}
const ACTIVE_COLOR := Color(1.0, 0.8, 0.0)  # #ffcc00
const LABEL_COLOR := Color(1, 1, 1, 0.7)
const HUMAN_TURN_MS := 7000
const BOT_TURN_MS := 800

var room: Variant = null
var state_ready := false
var local_seat_index := 0
var my_session_id := ""

# HUD root
var hud_root: Control

# Player labels: visual_pos -> {container, name_label, count_label, timer_arc}
var player_labels: Dictionary = {}

# Room code
var room_code_label: Label
var copied := false
var copy_timer: SceneTreeTimer = null

# Winner overlay
var winner_overlay: ColorRect
var winner_label: Label
var new_game_btn: Button

# Turn timer arcs
var timer_arcs: Dictionary = {}  # visual_pos -> Node2D


func setup(p_room: Variant) -> void:
	room = p_room


func _ready() -> void:
	layer = 10
	_build_hud()

	if room:
		my_session_id = room.get_session_id()
		room.state_changed.connect(func(): state_ready = true)


func _build_hud() -> void:
	hud_root = Control.new()
	hud_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hud_root)

	# Room code label (top-left)
	room_code_label = Label.new()
	room_code_label.text = ""
	room_code_label.add_theme_font_size_override("font_size", 12)
	room_code_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
	room_code_label.position = Vector2(16, 12)
	room_code_label.mouse_filter = Control.MOUSE_FILTER_STOP
	room_code_label.gui_input.connect(_on_room_code_input)
	hud_root.add_child(room_code_label)

	# Player labels (created for each position)
	for vp in range(4):
		_create_player_label(vp)

	# Winner overlay (initially hidden)
	winner_overlay = ColorRect.new()
	winner_overlay.color = Color(0, 0, 0, 0.5)
	winner_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	winner_overlay.visible = false
	winner_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud_root.add_child(winner_overlay)

	var winner_center := CenterContainer.new()
	winner_center.set_anchors_preset(Control.PRESET_FULL_RECT)
	winner_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	winner_overlay.add_child(winner_center)

	var winner_vbox := VBoxContainer.new()
	winner_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	winner_vbox.add_theme_constant_override("separation", 20)
	winner_vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	winner_center.add_child(winner_vbox)

	winner_label = Label.new()
	winner_label.text = ""
	winner_label.add_theme_font_size_override("font_size", 48)
	winner_label.add_theme_color_override("font_color", ACTIVE_COLOR)
	winner_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	winner_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	winner_vbox.add_child(winner_label)

	new_game_btn = Button.new()
	new_game_btn.text = "NEW GAME"
	new_game_btn.custom_minimum_size = Vector2(200, 48)
	new_game_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var btn_style := StyleBoxFlat.new()
	btn_style.bg_color = ACTIVE_COLOR
	btn_style.corner_radius_top_left = 12
	btn_style.corner_radius_top_right = 12
	btn_style.corner_radius_bottom_left = 12
	btn_style.corner_radius_bottom_right = 12
	new_game_btn.add_theme_stylebox_override("normal", btn_style)
	new_game_btn.add_theme_stylebox_override("hover", btn_style)
	new_game_btn.add_theme_stylebox_override("pressed", btn_style)
	new_game_btn.add_theme_color_override("font_color", Color(0.1, 0.1, 0.1))
	new_game_btn.add_theme_color_override("font_hover_color", Color(0.1, 0.1, 0.1))
	new_game_btn.add_theme_color_override("font_pressed_color", Color(0.1, 0.1, 0.1))
	new_game_btn.add_theme_font_size_override("font_size", 18)
	new_game_btn.pressed.connect(func():
		if room:
			room.send_message("restart", {})
	)
	winner_vbox.add_child(new_game_btn)


func _create_player_label(visual_pos: int) -> void:
	var container := Control.new()
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	container.visible = false

	var hbox := HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 6)
	hbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	container.add_child(hbox)

	# Timer arc placeholder (custom drawing node)
	var timer_node := Node2D.new()
	timer_node.visible = false
	timer_node.z_index = 0
	timer_arcs[visual_pos] = timer_node
	# Timer will be drawn via _draw connected later

	# Player name
	var name_label := Label.new()
	name_label.text = ""
	name_label.add_theme_font_size_override("font_size", 13)
	name_label.add_theme_color_override("font_color", LABEL_COLOR)
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hbox.add_child(name_label)

	# Card count badge
	var count_label := Label.new()
	count_label.text = "0"
	count_label.add_theme_font_size_override("font_size", 11)
	count_label.add_theme_color_override("font_color", Color.WHITE)
	count_label.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var badge := PanelContainer.new()
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var badge_style := StyleBoxFlat.new()
	badge_style.bg_color = Color(0, 0, 0, 0.4)
	badge_style.corner_radius_top_left = 8
	badge_style.corner_radius_top_right = 8
	badge_style.corner_radius_bottom_left = 8
	badge_style.corner_radius_bottom_right = 8
	badge_style.content_margin_left = 6
	badge_style.content_margin_right = 6
	badge_style.content_margin_top = 2
	badge_style.content_margin_bottom = 2
	badge.add_theme_stylebox_override("panel", badge_style)
	badge.add_child(count_label)
	hbox.add_child(badge)

	hud_root.add_child(container)
	hud_root.add_child(timer_node)

	player_labels[visual_pos] = {
		"container": container,
		"hbox": hbox,
		"name_label": name_label,
		"count_label": count_label,
	}


func _process(_delta: float) -> void:
	if not state_ready or not room:
		return

	var state = room.get_state()
	if state == null:
		return

	# Update local seat
	_update_local_seat(state)

	# Room code
	if room_code_label.text == "" or (not copied and room_code_label.text != room.get_id()):
		room_code_label.text = room.get_id() if not copied else "Copied!"

	# Update player labels
	_update_player_labels(state)

	# Update winner overlay
	_update_winner(state)

	# Update turn timers
	_update_turn_timers(state)


func _update_local_seat(state) -> void:
	var players = state.get("players", null)
	if players == null:
		return
	var keys := _iter_map_keys(players)
	for key in keys:
		var p = _map_get(players, key)
		if p and p.get("sessionId", "") == my_session_id:
			local_seat_index = p.get("seatIndex", 0)
			break


func _update_player_labels(state) -> void:
	var vs := get_viewport().get_visible_rect().size
	var players = state.get("players", null)
	var current_player: int = state.get("currentPlayer", -1)
	var winner: int = state.get("winner", -1)

	# Reset all labels to hidden
	for vp in player_labels:
		player_labels[vp]["container"].visible = false

	if players == null:
		return

	for key in _iter_map_keys(players):
		var player = _map_get(players, key)
		if player == null:
			continue
		var seat: int = player.get("seatIndex", 0)
		var vis_pos := ((seat - local_seat_index) + 4) % 4

		if not player_labels.has(vis_pos):
			continue

		var data: Dictionary = player_labels[vis_pos]
		var container: Control = data["container"]
		var name_label: Label = data["name_label"]
		var count_label: Label = data["count_label"]

		container.visible = true
		name_label.text = player.get("name", "Player")
		count_label.text = str(player.get("handCount", 0))

		var is_active := current_player == seat and winner == -1
		var color := ACTIVE_COLOR if is_active else LABEL_COLOR
		name_label.add_theme_color_override("font_color", color)

		var label_scale := 1.1 if is_active else 1.0
		container.scale = Vector2.ONE * label_scale

		# Position based on visual position
		match vis_pos:
			0:  # Bottom
				container.position = Vector2(vs.x * 0.5 - 50, vs.y * 0.96 - 20)
			1:  # Left
				container.position = Vector2(8, vs.y * 0.5 - 10)
			2:  # Top
				container.position = Vector2(vs.x * 0.5 - 50, 8)
			3:  # Right
				container.position = Vector2(vs.x - 120, vs.y * 0.5 - 10)


func _update_turn_timers(state) -> void:
	var turn_deadline: float = state.get("turnDeadline", 0)
	var current_player: int = state.get("currentPlayer", -1)
	var winner: int = state.get("winner", -1)
	var players = state.get("players", null)

	# Hide all timers
	for vp in timer_arcs:
		timer_arcs[vp].visible = false

	if turn_deadline <= 0 or winner != -1 or players == null:
		return

	var now := Time.get_unix_time_from_system() * 1000.0
	var remaining := maxf(0.0, turn_deadline - now)

	# Find the current player's bot status
	var is_bot := false
	for key in _iter_map_keys(players):
		var p = _map_get(players, key)
		if p and p.get("seatIndex", 0) == current_player:
			is_bot = p.get("isBot", false)
			break

	var duration := BOT_TURN_MS if is_bot else HUMAN_TURN_MS
	var progress := clampf(remaining / float(duration), 0.0, 1.0)

	var vis_pos := ((current_player - local_seat_index) + 4) % 4
	if not timer_arcs.has(vis_pos):
		return

	var timer_node: Node2D = timer_arcs[vis_pos]
	timer_node.visible = true

	# Position timer next to the label
	var label_data: Dictionary = player_labels.get(vis_pos, {})
	var container = label_data.get("container", null)
	if container:
		timer_node.position = Vector2(container.position.x - 20, container.position.y + 10)

	# Determine color
	var timer_color := Color(0.2, 0.733, 0.267)  # green
	if progress <= 0.2:
		timer_color = Color(1.0, 0.267, 0.267)  # red
	elif progress <= 0.5:
		timer_color = Color(1.0, 0.8, 0.0)  # yellow

	timer_node.set_meta("timer_progress", progress)
	timer_node.set_meta("timer_color", timer_color)

	if not timer_node.has_meta("draw_connected"):
		timer_node.set_meta("draw_connected", true)
		timer_node.draw.connect(func():
			var prog: float = timer_node.get_meta("timer_progress", 1.0)
			var col: Color = timer_node.get_meta("timer_color", Color.GREEN)
			# Background ring
			timer_node.draw_arc(Vector2.ZERO, 9.0, 0, TAU, 32, Color(1, 1, 1, 0.15), 2.5)
			# Progress arc
			if prog > 0.001:
				var start_angle := -PI / 2.0
				var end_angle := start_angle + TAU * prog
				timer_node.draw_arc(Vector2.ZERO, 9.0, start_angle, end_angle, 32, col, 2.5)
		)

	timer_node.queue_redraw()


func _update_winner(state) -> void:
	var winner: int = state.get("winner", -1)
	if winner != -1:
		winner_overlay.visible = true
		winner_overlay.mouse_filter = Control.MOUSE_FILTER_STOP

		# Find winner name
		var winner_name := "Player"
		var players = state.get("players", null)
		if players:
			for key in _iter_map_keys(players):
				var p = _map_get(players, key)
				if p and p.get("seatIndex", 0) == winner:
					winner_name = p.get("name", "Player")
					break

		winner_label.text = "%s wins!" % winner_name.to_upper()
	else:
		winner_overlay.visible = false
		winner_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _on_room_code_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if room:
			DisplayServer.clipboard_set(room.get_id())
			room_code_label.text = "Copied!"
			room_code_label.add_theme_color_override("font_color", ACTIVE_COLOR)
			copied = true
			if copy_timer:
				copy_timer = null
			copy_timer = get_tree().create_timer(1.5)
			copy_timer.timeout.connect(func():
				copied = false
				room_code_label.text = room.get_id()
				room_code_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
			)


# ── Helpers ──

func _iter_map_keys(map_obj) -> Array:
	if map_obj is Dictionary:
		return map_obj.keys()
	if map_obj and map_obj.has_method("keys"):
		return map_obj.keys()
	return []


func _map_get(map_obj, key: String):
	if map_obj is Dictionary:
		return map_obj.get(key)
	if map_obj and map_obj.has_method("get_item"):
		return map_obj.get_item(key)
	return null
