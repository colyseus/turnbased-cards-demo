extends Control

## Lobby screen: name input, Quick Play, Join by Code.
##
## Styled to match the GameMaker client: radial-ish green gradient background,
## large yellow "CARD GAME" title with a floating wild_draw4 hero card next to
## it, and a fade-in on entry.

signal joined(client: Variant, room: Variant)

# ── Palette (matching GameMaker scr_constants.gml) ──
const CLR_LOBBY_CENTER := Color(0.118, 0.557, 0.271)  # #1e8e45
const CLR_LOBBY_EDGE := Color(0.051, 0.239, 0.125)  # #0d3d20
const CLR_HIGHLIGHT := Color(1.0, 0.8, 0.0)          # #ffcc00
const CLR_ERROR := Color(1.0, 0.42, 0.42)            # #ff6b6b
const CLR_BTN_TEXT := Color(0.1, 0.1, 0.1)

const FADE_IN_SPEED := 3.0  # alpha units per second
const HERO_BOB_HZ := 0.33   # ~3s per bob cycle

var server_url: String = "ws://localhost:2567"
var is_joining: bool = false
var client: Variant = null

# ── UI nodes ──
var gradient_bg: Control
var content: Control  # wraps everything that fades in
var hero_card: Sprite2D
var hero_base_pos: Vector2
var hero_time: float = 0.0
var fade_alpha: float = 0.0

var title_label: Label
var subtitle_label: Label
var name_input: LineEdit
var quick_play_btn: Button
var divider_label: Label
var code_input: LineEdit
var join_btn: Button
var error_label: Label


func _ready() -> void:
	_parse_args()
	_build_ui()
	# Auto-join when --autojoin=NAME is passed (headless debugging).
	for arg in OS.get_cmdline_args():
		if arg.begins_with("--autojoin="):
			name_input.text = arg.substr(11)
			call_deferred("_on_quick_play")


func _parse_args() -> void:
	var explicit_server := false
	for arg in OS.get_cmdline_args():
		if arg.begins_with("--server="):
			server_url = arg.substr(9)
			explicit_server = true
	if not OS.has_feature("debug") and not explicit_server:
		server_url = "wss://uno-demo.colyseus.dev"


# ── UI construction ──────────────────────────────────────────────

func _build_ui() -> void:
	_build_background()
	_build_content()
	_build_hero_card()

	# Grab focus on name input
	name_input.grab_focus.call_deferred()


## Radial-ish gradient rendered via a custom _draw Control (concentric
## rounded rectangles from edge color → center color), matching
## obj_lobby/Draw_64.gml:15-25.
func _build_background() -> void:
	gradient_bg = Control.new()
	gradient_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	gradient_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	gradient_bg.draw.connect(_draw_gradient)
	add_child(gradient_bg)
	gradient_bg.resized.connect(gradient_bg.queue_redraw)


func _draw_gradient() -> void:
	var size := gradient_bg.size
	# Outer fill
	gradient_bg.draw_rect(Rect2(Vector2.ZERO, size), CLR_LOBBY_EDGE, true)
	# 20 concentric rects lerping edge → center
	var steps := 20
	var unit := minf(size.x, size.y)
	for i in range(steps, -1, -1):
		var t := float(i) / float(steps)
		var color := CLR_LOBBY_EDGE.lerp(CLR_LOBBY_CENTER, t)
		var margin := t * unit * 0.5
		var rect := Rect2(Vector2(margin, margin), size - Vector2(margin, margin) * 2.0)
		gradient_bg.draw_rect(rect, color, true)


func _build_content() -> void:
	content = Control.new()
	content.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.modulate.a = 0.0
	add_child(content)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.add_child(center)

	var vbox := VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 14)
	center.add_child(vbox)

	title_label = Label.new()
	title_label.text = "CARD GAME"
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.add_theme_font_size_override("font_size", 72)
	title_label.add_theme_color_override("font_color", CLR_HIGHLIGHT)
	vbox.add_child(title_label)

	subtitle_label = Label.new()
	subtitle_label.text = "COLYSEUS DEMO"
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle_label.add_theme_font_size_override("font_size", 16)
	subtitle_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
	vbox.add_child(subtitle_label)

	# Spacer
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 18)
	vbox.add_child(spacer)

	name_input = _make_input("Enter your name...", 280, 40, 18, 2)
	name_input.max_length = 16
	name_input.alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(name_input)

	quick_play_btn = _make_yellow_button("QUICK PLAY", 280, 44, 18)
	quick_play_btn.pressed.connect(_on_quick_play)
	vbox.add_child(quick_play_btn)

	divider_label = Label.new()
	divider_label.text = "OR JOIN BY CODE"
	divider_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	divider_label.add_theme_font_size_override("font_size", 12)
	divider_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.35))
	vbox.add_child(divider_label)

	var code_row := HBoxContainer.new()
	code_row.alignment = BoxContainer.ALIGNMENT_CENTER
	code_row.add_theme_constant_override("separation", 8)
	vbox.add_child(code_row)

	code_input = _make_input("Room code...", 180, 38, 14, 1)
	code_row.add_child(code_input)

	join_btn = _make_yellow_button("JOIN", 90, 38, 14)
	join_btn.pressed.connect(_on_join_by_code)
	code_row.add_child(join_btn)

	error_label = Label.new()
	error_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	error_label.add_theme_font_size_override("font_size", 14)
	error_label.add_theme_color_override("font_color", CLR_ERROR)
	error_label.visible = false
	vbox.add_child(error_label)


func _build_hero_card() -> void:
	var tex := load("res://assets/cards/wild_draw4.png") as Texture2D
	if tex == null:
		return
	hero_card = Sprite2D.new()
	hero_card.texture = tex
	hero_card.scale = Vector2(0.35, 0.35)
	hero_card.rotation_degrees = 12
	content.add_child(hero_card)
	_place_hero_card()
	content.resized.connect(_place_hero_card)


func _place_hero_card() -> void:
	if hero_card == null: return
	var vp := size
	# Sit just right of the centered title — keep layout responsive.
	hero_base_pos = Vector2(vp.x * 0.5 + 180, vp.y * 0.5 - 180)
	hero_card.position = hero_base_pos


func _make_input(placeholder: String, w: int, h: int, font_size: int, border: int) -> LineEdit:
	var le := LineEdit.new()
	le.placeholder_text = placeholder
	le.custom_minimum_size = Vector2(w, h)
	le.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.3)
	style.border_color = Color(1, 1, 1, 0.5)
	style.border_width_top = border
	style.border_width_bottom = border
	style.border_width_left = border
	style.border_width_right = border
	style.set_corner_radius_all(8)
	style.content_margin_left = 12
	style.content_margin_right = 12
	le.add_theme_stylebox_override("normal", style)
	var focus_style := style.duplicate() as StyleBoxFlat
	focus_style.border_color = CLR_HIGHLIGHT
	le.add_theme_stylebox_override("focus", focus_style)
	le.add_theme_color_override("font_color", Color.WHITE)
	le.add_theme_color_override("font_placeholder_color", Color(1, 1, 1, 0.4))
	le.add_theme_font_size_override("font_size", font_size)
	return le


func _make_yellow_button(text: String, w: int, h: int, font_size: int) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = Vector2(w, h)
	btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var style := StyleBoxFlat.new()
	style.bg_color = CLR_HIGHLIGHT
	style.set_corner_radius_all(8)
	var hover := style.duplicate() as StyleBoxFlat
	hover.bg_color = CLR_HIGHLIGHT.lightened(0.1)
	btn.add_theme_stylebox_override("normal", style)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", style)
	btn.add_theme_color_override("font_color", CLR_BTN_TEXT)
	btn.add_theme_color_override("font_hover_color", CLR_BTN_TEXT)
	btn.add_theme_color_override("font_pressed_color", CLR_BTN_TEXT)
	btn.add_theme_font_size_override("font_size", font_size)
	return btn


# ── Animation ────────────────────────────────────────────────────

func _process(delta: float) -> void:
	# Fade in content + hero card together.
	if fade_alpha < 1.0:
		fade_alpha = minf(1.0, fade_alpha + FADE_IN_SPEED * delta)
		content.modulate.a = fade_alpha

	# Hero card bob + gentle rotation.
	if hero_card:
		hero_time += delta
		var wave := sin(hero_time * TAU * HERO_BOB_HZ)
		hero_card.position = hero_base_pos + Vector2(0, wave * 6.0)
		hero_card.rotation_degrees = 12.0 + wave * 2.0


# ── Networking ───────────────────────────────────────────────────

func _set_joining(val: bool) -> void:
	is_joining = val
	name_input.editable = not val
	code_input.editable = not val
	quick_play_btn.disabled = val
	join_btn.disabled = val
	var mod_a := 0.5 if val else 1.0
	quick_play_btn.modulate.a = mod_a
	join_btn.modulate.a = mod_a


func _on_quick_play() -> void:
	if is_joining: return
	_join_room(func(c: Variant, pname: String): return c.join_or_create("uno", {"name": pname}))


func _on_join_by_code() -> void:
	if is_joining: return
	var code := code_input.text.strip_edges()
	if code == "":
		return
	_join_room(func(c: Variant, pname: String): return c.join_by_id(code, {"name": pname}))


## Shared connect-and-wire flow for both Quick Play and Join-by-Code.
## `joiner.call(client, player_name)` should return a Room (or null).
func _join_room(joiner: Callable) -> void:
	_set_joining(true)
	error_label.visible = false

	var player_name := name_input.text.strip_edges()
	if player_name == "":
		player_name = "Player"

	client = Colyseus.create_client()
	if not client:
		_show_error("Colyseus GDExtension not loaded")
		_set_joining(false)
		return

	client.set_endpoint(server_url)
	var room = joiner.call(client, player_name)
	if not room:
		_show_error("Failed to connect. Is server running?")
		_set_joining(false)
		return

	room.joined.connect(func(): joined.emit(client, room))
	room.error.connect(func(code: int, message: String):
		_show_error("Error [%d]: %s" % [code, message])
		_set_joining(false)
	)


func _show_error(msg: String) -> void:
	error_label.text = msg
	error_label.visible = true
