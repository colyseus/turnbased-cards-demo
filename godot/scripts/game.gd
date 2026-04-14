extends Node2D

## UNO game controller — card rendering, layout, input, Colyseus state sync.
##
## State synchronization with Colyseus has three mildly quirky rules in the
## Godot SDK that dictate the architecture here:
##
##   1. `callbacks.listen("scalar", ...)` fires with null for numeric fields
##      on the initial subscription pass and does not fire retroactively.
##      We poll scalars from `room.get_state()` each frame and null-guard
##      the listeners so real changes still land.
##
##   2. Lambda-wrapped callbacks at the root level do not fire. Use named
##      methods as Callables (e.g. `callbacks.on_add("foo", _on_foo_cb)`).
##      Nested-schema callbacks do accept lambdas.
##
##   3. `discard on_add` fires before `hand on_remove` for a local play, so
##      the played card is transiently in both collections. `get_ordered_
##      local_hand()` gives discard precedence, mirroring GameMaker's
##      `_placed` dict pattern.
##
## Round restart: `hand on_remove` is not fired for every card when a
## `splice(0, len)` + re-deal cycle happens in a single patch, so we lazy-
## clear stale entities on the first hand/discard on_add after a winner was
## declared (see `_pending_round_reset`).

# ── Color constants ──
const COLOR_HEX := {
	"red": Color(1.0, 0.2, 0.2),
	"blue": Color(0.2, 0.467, 1.0),
	"green": Color(0.2, 0.733, 0.267),
	"yellow": Color(1.0, 0.8, 0.0),
}
const FELT_COLOR := Color(0.102, 0.478, 0.235)
const SHOWCASE_DURATION_MS := 700
const AUTO_DRAW_DELAY_MS := 800
## Turn-arrow target angle per visual seat position (bottom, left, top, right).
const PLAYER_ANGLE := [PI / 2.0, PI, -PI / 2.0, 0.0]
const PICKER_COLORS := ["red", "yellow", "green", "blue"]
const PICKER_STAGGER_MS := 80

# ── Colyseus ──
var room: Variant = null
var callbacks: Colyseus.Callbacks = null
var my_session_id := ""

# ── Textures ──
var card_textures: Dictionary = {}  # texture_id -> Texture2D
var back_texture: Texture2D

# ── Cached state (populated by callbacks + per-frame polling) ──
var local_seat_index := -1
var phase: String = "waiting"
var current_player: int = -1
var direction: int = 1
var active_color: String = ""
var pending_draw: int = 0
var draw_pile_count: int = 0
var winner: int = -1
## seat_index(int) → { seatIndex, sessionId, name, isBot, connected,
## handCount, is_local, schema, hand_bound }.
var players: Dictionary = {}
## Each entry: { id, cardType, color, value, chosenColor }.
var local_hand: Array = []
var discard_pile: Array = []
## Round-restart plumbing. See class-level docs.
var _prev_winner_for_reset: int = -1
var _pending_round_reset: bool = false

# ── Scene nodes ──
var cards_node: Node2D
var animator: CardAnimator
var felt_bg: ColorRect
var turn_arrow_node: Node2D
var dir_arrows_node: Node2D
var ring_group: Node2D
var picker_layer: CanvasLayer
var picker_overlay: ColorRect

# ── Interaction state ──
var hovered_card: String = ""
var showcase_card_id: String = ""
var showcase_timer: SceneTreeTimer = null
var color_picker_for: String = ""  # card ID of wild being picked
var hovered_picker_color: String = ""
var hit_areas: Array[Area2D] = []
var auto_draw_timer: SceneTreeTimer = null
# Memo keys so reflow only runs when the inputs change.
var prev_hover: String = ""
var prev_playable_hash: int = 0

# DEBUG: `--autoplay` cmd-line flag picks the first playable non-wild card
# each turn, for autonomous headless testing.
var _autoplay: bool = false
var _autoplay_pending: bool = false

# HTML5 canvas sizing resolves asynchronously, so `get_viewport_rect().size`
# is often zero at `_ready`. We flag the first frame where the layout has
# real dimensions and do a one-shot reflow so opponent hands (and other
# visuals that were pinned at origin) snap to correct poses.
var _layout_ready: bool = false

# On HTML5, `room.get_state()` returns null at `_ready` — the Colyseus SDK
# decodes state asynchronously after the `joined` signal. We defer the
# initial snap to the first `_process` frame where state is populated.
var _seeded: bool = false

# ── Turn indicator spring ──
var turn_arrow_angle := -PI / 2.0
var turn_arrow_vel := 0.0
var turn_arrow_target := -PI / 2.0
var prev_turn_visual_pos := 0
var dir_spin := 0.0

# ── Color ring spring ──
var ring_scale_vel := 0.0
var prev_active_color := ""

# ── Color picker spring ──
var picker_circles: Array[Node2D] = []
var picker_circle_vels: Array[float] = [0.0, 0.0, 0.0, 0.0]
var picker_elapsed := 0.0
var picker_overlay_alpha := 0.0
var picker_overlay_vel := 0.0


func setup(p_room: Variant) -> void:
	room = p_room


func _ready() -> void:
	for arg in OS.get_cmdline_args():
		if arg == "--autoplay":
			_autoplay = true
	_preload_textures()
	_build_scene()

	get_tree().root.size_changed.connect(_on_viewport_resized)

	if room:
		my_session_id = room.get_session_id()
		# Register first so retroactive on_add callbacks start populating the
		# cache as soon as state arrives. _seed_initial_state runs lazily from
		# _process once state is actually available (web is async).
		_register_callbacks()
		_try_seed_initial_state()


func _on_viewport_resized() -> void:
	if animator:
		animator.reflow_all()


func _preload_textures() -> void:
	back_texture = _load_card_texture("back")
	var colors := ["red", "blue", "green", "yellow"]
	var values := ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"]
	for c in colors:
		for v in values:
			var tid := "%s_%s" % [c, v]
			card_textures[tid] = _load_card_texture(tid)
	card_textures["wild"] = _load_card_texture("wild")
	card_textures["wild_draw4"] = _load_card_texture("wild_draw4")
	card_textures["back"] = back_texture


func _load_card_texture(tid: String) -> Texture2D:
	var path := "res://assets/cards/%s.png" % tid
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	push_warning("Card texture not found: %s" % path)
	return null


func _build_scene() -> void:
	# Felt background (uses CanvasLayer at layer -1 so it's behind everything)
	var bg_layer := CanvasLayer.new()
	bg_layer.layer = -1
	add_child(bg_layer)
	felt_bg = ColorRect.new()
	felt_bg.color = FELT_COLOR
	felt_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	felt_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg_layer.add_child(felt_bg)

	# Cards container
	cards_node = Node2D.new()
	cards_node.name = "Cards"
	add_child(cards_node)

	# Animator
	animator = CardAnimator.new()
	animator.name = "CardAnimator"
	add_child(animator)
	animator.setup(self, cards_node, card_textures, back_texture)

	# Turn indicator
	turn_arrow_node = Node2D.new()
	turn_arrow_node.name = "TurnArrow"
	add_child(turn_arrow_node)

	dir_arrows_node = Node2D.new()
	dir_arrows_node.name = "DirArrows"
	add_child(dir_arrows_node)

	# Color ring group
	ring_group = Node2D.new()
	ring_group.name = "ColorRing"
	add_child(ring_group)

	# Picker overlay (CanvasLayer so it covers everything)
	picker_layer = CanvasLayer.new()
	picker_layer.layer = 5
	picker_layer.name = "PickerLayer"
	add_child(picker_layer)
	picker_overlay = ColorRect.new()
	picker_overlay.color = Color(0, 0, 0, 0)
	picker_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	picker_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	picker_overlay.visible = false
	picker_layer.add_child(picker_overlay)


# ── Networking (schema callbacks) ──

## Attempts to do the initial snapshot. Returns true when state is available
## and the snapshot has been taken; otherwise returns false so `_process`
## keeps retrying. Safe to call repeatedly — clears caches first so if
## retroactive callbacks filled them in the meantime, we re-seed cleanly.
func _try_seed_initial_state() -> bool:
	if _seeded:
		return true
	var state = room.get_state()
	if state == null:
		return false
	if state.get("players", null) == null:
		return false  # state object exists but hasn't been decoded yet
	_seeded = true
	_seed_initial_state()
	return true


## Read current state into local caches and take the initial animator
## snapshot. Idempotent (safely callable after retroactive on_add callbacks
## have partially populated caches — we clear first).
func _seed_initial_state() -> void:
	var state = room.get_state()
	if state == null:
		return

	players.clear()
	local_hand.clear()
	discard_pile.clear()
	local_seat_index = -1

	phase = state.get("phase", "waiting")
	current_player = int(state.get("currentPlayer", -1))
	direction = int(state.get("direction", 1))
	active_color = state.get("activeColor", "")
	pending_draw = int(state.get("pendingDraw", 0))
	draw_pile_count = int(state.get("drawPileCount", 0))
	winner = int(state.get("winner", -1))

	var state_players = state.get("players", null)
	for key in _iter_map_keys(state_players):
		var p = _map_get(state_players, key)
		if p != null:
			_cache_player(p)

	# Schema sends [oldest, ..., newest]; our convention is newest at index 0.
	for c in _iter_array(state.get("discardPile", null)):
		if c != null:
			discard_pile.insert(0, _card_to_dict(c))

	var local_player = players.get(local_seat_index)
	if local_player:
		for c in _iter_array(local_player.schema.get("hand", null)):
			if c != null:
				local_hand.append(_card_to_dict(c))

	animator.snap_from_state(state, local_seat_index)


func _register_callbacks() -> void:
	callbacks = Colyseus.Callbacks.of(room)
	if callbacks == null:
		push_error("Colyseus callbacks unavailable")
		return

	# Scalar fields
	callbacks.listen("phase", _on_scalar_phase)
	callbacks.listen("currentPlayer", _on_scalar_current_player)
	callbacks.listen("direction", _on_scalar_direction)
	callbacks.listen("activeColor", _on_scalar_active_color)
	callbacks.listen("pendingDraw", _on_scalar_pending_draw)
	callbacks.listen("winner", _on_scalar_winner)
	callbacks.listen("drawPileCount", _on_scalar_draw_pile_count)

	# Players map
	callbacks.on_add("players", _on_players_add_cb)
	callbacks.on_remove("players", _on_players_remove_cb)

	# Discard pile
	callbacks.on_add("discardPile", _on_discard_add_cb)
	callbacks.on_remove("discardPile", _on_discard_remove_cb)

	# `listen` does not fire retroactively for scalars in the Godot SDK, so
	# pull an initial snapshot now that the state is populated.
	_refresh_scalars_from_state()


## Per-frame refresh of scalar cached state from room.get_state(). Needed
## because the SDK's listen() callbacks don't deliver reliable values.
func _refresh_scalars_from_state() -> void:
	var state = room.get_state()
	if state == null: return
	var cp = state.get("currentPlayer", null)
	if cp != null: current_player = int(cp)
	var w = state.get("winner", null)
	if w != null:
		var new_winner: int = int(w)
		# Winner transitioned from -1 to a seat → round just ended. Flag that
		# the NEXT hand or discard on_add belongs to a fresh round and stale
		# entities from this round must be wiped first.
		if _prev_winner_for_reset == -1 and new_winner != -1:
			_pending_round_reset = true
		_prev_winner_for_reset = new_winner
		winner = new_winner
	var ph = state.get("phase", null)
	if ph != null: phase = str(ph)
	var dir_val = state.get("direction", null)
	if dir_val != null: direction = int(dir_val)
	var ac = state.get("activeColor", null)
	if ac != null: active_color = str(ac)
	var pd = state.get("pendingDraw", null)
	if pd != null: pending_draw = int(pd)
	var dpc = state.get("drawPileCount", null)
	if dpc != null:
		var new_count = int(dpc)
		if new_count != draw_pile_count:
			draw_pile_count = new_count
			animator.draw_stack_count = draw_pile_count
			animator.rebuild_draw_stack()

	# Safety net for opponent handCount changes that aren't paired with a
	# discard event (e.g., wild_draw4/draw2 forced draws). The discard path
	# also calls this.
	_sync_player_counts_and_find_player()


# Scalar listen callbacks. Null-guarded because the Godot SDK fires numeric
# fields as `null` on the initial subscription pass (only strings come through
# with real values). Real changes always deliver a concrete value.

func _on_scalar_phase(v, _prev) -> void:
	if v == null: return
	phase = str(v)

func _on_scalar_current_player(v, _prev) -> void:
	if v == null: return
	current_player = int(v)

func _on_scalar_direction(v, _prev) -> void:
	if v == null: return
	direction = int(v)

func _on_scalar_active_color(v, _prev) -> void:
	if v == null: return
	active_color = str(v)

func _on_scalar_pending_draw(v, _prev) -> void:
	if v == null: return
	pending_draw = int(v)

func _on_scalar_winner(v, _prev) -> void:
	if v == null: return
	winner = int(v)

func _on_scalar_draw_pile_count(v, _prev) -> void:
	if v == null: return
	draw_pile_count = int(v)
	animator.draw_stack_count = draw_pile_count
	animator.rebuild_draw_stack()


func _on_players_add_cb(player, _key) -> void:
	_on_player_add(player)

func _on_players_remove_cb(_player, key) -> void:
	players.erase(int(key))

func _on_discard_add_cb(card, _idx) -> void:
	_on_discard_add(card)

func _on_discard_remove_cb(card, _idx) -> void:
	_on_discard_remove(card)


func _on_player_add(player) -> void:
	var seat: int = int(player.get("seatIndex", 0))
	var is_local: bool = (player.get("sessionId", "") == my_session_id)
	if is_local:
		local_seat_index = seat

	# Dedup: _seed_initial_state may have cached this player already.
	if not players.has(seat):
		_cache_player(player)

	# Hand add/remove — only visible for local player via StateView.
	if is_local:
		_bind_hand_callbacks(player)


func _bind_hand_callbacks(player) -> void:
	var seat := int(player.get("seatIndex", 0))
	var p = players.get(seat, {})
	if p.get("hand_bound", false):
		return
	p.hand_bound = true
	callbacks.on_add(player, "hand", func(card, _idx): _on_local_hand_add(card))
	callbacks.on_remove(player, "hand", func(card, _idx): _on_local_hand_remove(card))


## Wipe caches + card entities from the previous round on the first hand or
## discard on_add after a winner was declared. See _pending_round_reset docs.
func _maybe_clear_stale_round() -> void:
	if not _pending_round_reset:
		return
	_pending_round_reset = false
	local_hand.clear()
	discard_pile.clear()
	animator.clear_card_entities()


func _on_local_hand_add(card) -> void:
	_maybe_clear_stale_round()
	var cid: String = card.get("id", "")
	for c in local_hand:
		if c.id == cid: return  # dedup (retroactive or initial seed)
	var dict := _card_to_dict(card)
	local_hand.append(dict)
	animator.playable_ids = _get_playable_set()
	animator.on_local_card_drawn(dict)


func _on_local_hand_remove(card) -> void:
	var cid: String = card.get("id", "")
	for i in range(local_hand.size()):
		if local_hand[i].id == cid:
			local_hand.remove_at(i)
			break
	# Immediately drop the hand entity. If the card is simultaneously being
	# pushed onto discard (local play), the subsequent on_discard_add will spawn
	# a fresh entity flying from hand center. For restart/forced-clear, we just
	# want the old entity gone.
	animator.remove_local_card(cid)

	# If we had the color picker open for this card, close it.
	if color_picker_for == cid:
		_close_color_picker()


func _on_discard_add(card) -> void:
	_maybe_clear_stale_round()
	var cid: String = card.get("id", "")
	for c in discard_pile:
		if c.id == cid: return  # dedup
	var dict := _card_to_dict(card)
	# Insert at front: the animator's pose/z-order convention treats index 0
	# as the top of the visual stack (just-played card).
	discard_pile.insert(0, dict)

	# Sync player handCounts before deciding from_seat. The Godot SDK's
	# on_change callbacks aren't reliable with lambdas (wrapper issue), so
	# we poll from state on demand.
	var from_seat: int = _sync_player_counts_and_find_player()

	# First card after the pile has been emptied (initial deal or post-restart
	# starter) — snap instead of animating a play.
	if discard_pile.size() == 1:
		animator.place_discard_card(dict)
		animator.reflow_all()
		return

	if from_seat < 0:
		from_seat = _prev_current_player_from_state()
	var is_local: bool = (from_seat == local_seat_index)

	animator.on_card_played(dict, from_seat, is_local)
	animator.reflow_all()


## Read player handCounts from state, compare with cached, trigger opponent
## draw animations for increases, and return the seat whose count decreased
## by exactly 1 (the seat that just played). Returns -1 if none.
func _sync_player_counts_and_find_player() -> int:
	var played_seat: int = -1
	var state = room.get_state()
	if state == null: return -1
	var sp = state.get("players", null)
	if sp == null: return -1
	for seat_key in _iter_map_keys(sp):
		var seat: int = int(seat_key)
		var state_player = _map_get(sp, seat_key)
		if state_player == null: continue
		var new_count: int = int(state_player.get("handCount", 0))
		var p = players.get(seat)
		if p == null:
			_cache_player(state_player)
			continue
		var prev_count: int = int(p.handCount)
		if new_count == prev_count: continue
		if new_count == prev_count - 1 and played_seat < 0:
			played_seat = seat
		elif new_count > prev_count and seat != local_seat_index:
			animator.on_opponent_drew(seat, new_count - prev_count, new_count)
			animator.reflow_opponent_hands()
		elif new_count < prev_count and seat != local_seat_index:
			# Multi-card drop (restart clear or mass draw resolution).
			for _i in range(prev_count - new_count):
				animator.remove_opponent_tail_slot(seat)
		# Update cached fields too (for bot→human swap detection).
		var new_session: String = state_player.get("sessionId", p.sessionId)
		p.sessionId = new_session
		p.isBot = bool(state_player.get("isBot", p.isBot))
		p.connected = bool(state_player.get("connected", p.connected))
		p.name = state_player.get("name", p.name)
		p.handCount = new_count
		if new_session == my_session_id and local_seat_index != seat:
			local_seat_index = seat
			p.is_local = true
	return played_seat


## Best-effort fallback when the handCount delta doesn't identify a single
## played-seat: step the state's currentPlayer back by one in the current
## direction. Only used when the sync loop couldn't find a -1 decrement.
func _prev_current_player_from_state() -> int:
	var cp := current_player if current_player >= 0 else 0
	var prev: int = ((cp - direction) % 4 + 4) % 4
	return prev


func _on_discard_remove(card) -> void:
	var cid: String = card.get("id", "")
	for i in range(discard_pile.size()):
		if discard_pile[i].id == cid:
			discard_pile.remove_at(i)
			break
	animator.exile_discard_card(cid)


## Cached player dict uses camelCase keys to match the Colyseus schema shape,
## so the animator and other call sites can use `p.get("seatIndex", 0)` etc.
## interchangeably with schema instances.
func _cache_player(player_schema) -> void:
	var seat := int(player_schema.get("seatIndex", 0))
	var session_id: String = player_schema.get("sessionId", "")
	var is_local_val: bool = (session_id == my_session_id)
	players[seat] = {
		"seatIndex": seat,
		"sessionId": session_id,
		"name": player_schema.get("name", "Player"),
		"isBot": bool(player_schema.get("isBot", false)),
		"connected": bool(player_schema.get("connected", true)),
		"handCount": int(player_schema.get("handCount", 0)),
		"is_local": is_local_val,
		"schema": player_schema,
		"hand_bound": false,
	}
	if is_local_val:
		local_seat_index = seat


func _card_to_dict(card) -> Dictionary:
	return {
		"id": card.get("id", ""),
		"cardType": card.get("cardType", "color"),
		"color": card.get("color", ""),
		"value": card.get("value", ""),
		"chosenColor": card.get("chosenColor", ""),
	}


# ── Layout ──

func _get_viewport_size() -> Vector2:
	return get_viewport_rect().size


func _compute_layout() -> Dictionary:
	var vs := _get_viewport_size()
	var vw := vs.x
	var vh := vs.y
	var portrait := vw < vh
	var unit := minf(vw, vh)

	var player_scale: float = (vw * 0.25 if portrait else unit * 0.21) / 375.0
	var player_spacing: float = player_scale * 375.0 * (0.28 if portrait else 0.36)
	var player_hover_scale: float = player_scale * 1.12
	var hover_lift: float = player_scale * 375.0 * 0.3
	var bottom_y: float = vh * 0.86

	var opponent_scale: float = (vw * 0.13 if portrait else unit * 0.11) / 375.0
	var h_spacing: float = opponent_scale * 375.0 * 0.35
	var v_spacing: float = opponent_scale * 375.0 * 0.35
	var top_y: float = vh * 0.12
	var side_x: float = clampf(vw * 0.42, unit * 0.3, vw * 0.46)
	var side_y_offset: float = vh * 0.47

	var pile_x_offset: float = clampf(unit * 0.12, vw * 0.05, vw * 0.15)
	var pile_scale: float = (vw * 0.14 if portrait else unit * 0.11) / 375.0
	var discard_scale: float = (vw * 0.16 if portrait else unit * 0.13) / 375.0

	var showcase_scale: float = (vw * 0.4 if portrait else unit * 0.3) / 375.0

	return {
		"vw": vw, "vh": vh,
		"player_scale": player_scale,
		"player_spacing": player_spacing,
		"player_hover_scale": player_hover_scale,
		"hover_lift": hover_lift,
		"bottom_y": bottom_y,
		"opponent_scale": opponent_scale,
		"h_spacing": h_spacing,
		"v_spacing": v_spacing,
		"top_y": top_y,
		"side_x": side_x,
		"side_y_offset": side_y_offset,
		"pile_x_offset": pile_x_offset,
		"pile_scale": pile_scale,
		"discard_scale": discard_scale,
		"showcase_scale": showcase_scale,
	}


# ── Helpers ──

func _get_visual_position(seat_index: int) -> int:
	return ((seat_index - local_seat_index) + 4) % 4


func _hash_rotation(id: String, index: int) -> float:
	var h := index * 7
	for i in range(id.length()):
		h = (h * 31 + id.unicode_at(i)) & 0x7FFFFFFF
	return float((h % 40) - 20) * (PI / 180.0)


func _card_texture_from_schema(card) -> String:
	var card_type: String = card.get("cardType", "color")
	if card_type == "wild":
		return card.get("value", "wild")
	return "%s_%s" % [card.get("color", "red"), card.get("value", "0")]


func _can_play_schema(card, top_card, active_color: String) -> bool:
	if card.get("cardType", "color") == "wild":
		return true
	if card.get("color", "") == active_color:
		return true
	if top_card.get("cardType", "") == "color" and card.get("value", "") == top_card.get("value", ""):
		return true
	return false


func _get_center_pos() -> Vector2:
	var vs := _get_viewport_size()
	return Vector2(vs.x * 0.5, vs.y * 0.5)


# ── State Accessors (read from local caches populated by schema callbacks) ──

## State accessors used by CardAnimator. Returning the cached views keeps the
## animator decoupled from the Colyseus state shape.
func _get_players() -> Dictionary:
	return players

func _get_discard_pile() -> Array:
	return discard_pile

func _get_local_hand() -> Array:
	return local_hand


# ── Platform-robust state iteration ──
# The Colyseus Godot SDK decodes state into native Dictionary/Array on some
# platforms (desktop builds we tested) and into its own Map/ArraySchema
# wrapper objects on others (HTML5 export). These helpers accept either.

## Returns all keys of a Dictionary OR a Colyseus Map-like object.
func _iter_map_keys(map_obj) -> Array:
	if map_obj == null:
		return []
	if map_obj is Dictionary:
		return map_obj.keys()
	if map_obj.has_method("keys"):
		return map_obj.keys()
	return []


## Gets a value from a Dictionary OR a Colyseus Map-like object.
func _map_get(map_obj, key):
	if map_obj == null:
		return null
	if map_obj is Dictionary:
		return map_obj.get(key)
	if map_obj.has_method("get_item"):
		return map_obj.get_item(key)
	return map_obj[key] if key in map_obj else null


## Normalizes a Dictionary OR Colyseus ArraySchema into a native Array.
func _iter_array(arr) -> Array:
	if arr == null:
		return []
	if arr is Array:
		return arr
	if arr.has_method("at") and arr.has_method("size"):
		var result: Array = []
		for i in range(arr.size()):
			result.append(arr.at(i))
		return result
	return []


# ── Playable Cards ──

func _get_playable_set() -> Dictionary:
	var result: Dictionary = {}
	if showcase_card_id != "":
		return result
	if color_picker_for != "":
		if hovered_picker_color != "":
			for card in local_hand:
				if card.id == color_picker_for:
					continue
				if card.color == hovered_picker_color:
					result[card.id] = true
		return result
	if current_player != local_seat_index:
		return result
	if winner != -1:
		return result
	if pending_draw > 0:
		return result
	if discard_pile.is_empty():
		return result

	# NOTE: preserves original convention — see _discard_pose z-order in
	# card_animator.gd, which treats index 0 as the visual top of the pile.
	var top_card = discard_pile[0]
	for card in local_hand:
		if _can_play_schema(card, top_card, active_color):
			result[card.id] = true

	return result


# ── Card Play / Interaction ──

func _on_card_clicked(card_id: String) -> void:
	if not room or showcase_card_id != "" or color_picker_for != "":
		return
	if not _get_playable_set().has(card_id):
		return
	var card = _find_local_card(card_id)
	if card == null:
		return

	if card.cardType == "wild":
		color_picker_for = card_id
		_open_color_picker()
		return

	room.send_message("play_card", {"cardId": card_id})
	hovered_card = ""
	_start_showcase(card_id)


func _on_picker_color_clicked(color: String) -> void:
	if not room or color_picker_for == "":
		return
	var card_id := color_picker_for
	room.send_message("play_card", {"cardId": card_id, "chosenColor": color})
	_close_color_picker()
	hovered_card = ""
	hovered_picker_color = ""
	_start_showcase(card_id)


func _start_showcase(card_id: String) -> void:
	showcase_card_id = card_id
	animator.set_showcase(card_id)
	if showcase_timer:
		showcase_timer = null
	showcase_timer = get_tree().create_timer(SHOWCASE_DURATION_MS / 1000.0)
	showcase_timer.timeout.connect(func():
		showcase_card_id = ""
		animator.set_showcase("")
	)


# ── Color Picker ──

func _open_color_picker() -> void:
	picker_overlay.visible = true
	# Keep IGNORE so Area2D physics picking receives clicks on the color circles.
	# Underlying card clicks are blocked by the color_picker_for guard in _on_card_clicked.
	picker_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	picker_elapsed = 0.0
	picker_overlay_alpha = 0.0
	picker_overlay_vel = 0.0
	picker_circle_vels = [0.0, 0.0, 0.0, 0.0]

	# Remove old circles
	for c in picker_circles:
		c.queue_free()
	picker_circles.clear()

	var center := _get_center_pos()
	var radius := 60.0

	for i in range(4):
		var angle := (float(i) / 4.0) * TAU - PI / 4.0
		var cx := center.x + cos(angle) * radius
		var cy := center.y + sin(angle) * radius

		var circle := Node2D.new()
		circle.position = Vector2(cx, cy)
		circle.scale = Vector2.ZERO
		circle.z_index = 200

		# Add a colored circle via _draw override — use Area2D with CollisionShape2D for clicks
		var area := Area2D.new()
		area.input_pickable = true
		var shape := CollisionShape2D.new()
		var circle_shape := CircleShape2D.new()
		circle_shape.radius = 35.0
		shape.shape = circle_shape
		area.add_child(shape)

		var color_str: String = PICKER_COLORS[i]
		area.input_event.connect(func(_viewport, event, _shape_idx):
			if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
				_on_picker_color_clicked(color_str)
		)
		area.mouse_entered.connect(func():
			hovered_picker_color = color_str
		)
		area.mouse_exited.connect(func():
			if hovered_picker_color == color_str:
				hovered_picker_color = ""
		)

		# Visual circle
		var vis := _create_circle_sprite(35.0, COLOR_HEX.get(PICKER_COLORS[i], Color.WHITE))
		circle.add_child(vis)
		circle.add_child(area)

		picker_layer.add_child(circle)
		picker_circles.append(circle)


func _create_circle_sprite(radius_px: float, color: Color) -> Node2D:
	var drawer := CircleDrawer.new()
	drawer.circle_radius = radius_px
	drawer.circle_color = color
	return drawer


func _close_color_picker() -> void:
	color_picker_for = ""
	hovered_picker_color = ""
	picker_overlay.visible = false
	picker_overlay.color.a = 0
	picker_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for c in picker_circles:
		c.queue_free()
	picker_circles.clear()


# ── Auto-Draw ──

## Auto-draw when the local player has no playable card (UNO convention) or
## a pending_draw penalty is active. Fires only on our own turn.
func _check_auto_draw() -> void:
	if not room:
		return
	if showcase_card_id != "" or color_picker_for != "":
		return
	if current_player != local_seat_index or winner != -1:
		return

	if pending_draw > 0:
		_schedule_auto_draw()
		return

	var playable := _get_playable_set()
	if playable.is_empty() and not local_hand.is_empty():
		_schedule_auto_draw()
		return

	_maybe_autoplay(playable)


func _schedule_auto_draw() -> void:
	if auto_draw_timer != null:
		return
	auto_draw_timer = get_tree().create_timer(AUTO_DRAW_DELAY_MS / 1000.0)
	auto_draw_timer.timeout.connect(func():
		auto_draw_timer = null
		if room:
			room.send_message("draw_card", {})
	)


## DEBUG helper. Gated on the `--autoplay` command-line flag, this plays
## the first playable non-wild card on the local player's turn so that
## the game progresses without user input during headless CI runs.
func _maybe_autoplay(playable: Dictionary) -> void:
	if not _autoplay or _autoplay_pending or playable.is_empty():
		return
	for cid in playable.keys():
		var card = _find_local_card(cid)
		if card == null or card.cardType == "wild":
			continue
		_autoplay_pending = true
		room.send_message("play_card", {"cardId": cid})
		get_tree().create_timer(0.8).timeout.connect(func(): _autoplay_pending = false)
		return


func _find_local_card(card_id: String):
	for c in local_hand:
		if c.id == card_id:
			return c
	return null


# ── Main Loop ──

func _process(delta: float) -> void:
	# Lazily complete the initial snapshot once the HTML5 SDK finishes
	# decoding state (null at `_ready` on web).
	if not _seeded:
		if not _try_seed_initial_state():
			return

	if local_seat_index < 0:
		return

	# Scalar fields have unreliable listen() callbacks in the Godot SDK —
	# refresh from state each frame. Cheap dict lookups.
	_refresh_scalars_from_state()

	var L := _compute_layout()

	# First frame with real viewport dimensions — reflow everything so any
	# entities that were snapped to (0,0) at _ready on web get repositioned.
	if not _layout_ready and L["vw"] > 0 and L["vh"] > 0:
		_layout_ready = true
		animator.reflow_all()

	# Hand layout may need a reflow if hover or playable set changed.
	_maybe_reflow_hand()

	# Update turn indicator
	_update_turn_indicator(L, delta)

	# Update color ring
	_update_color_ring(L, delta)

	# Update color picker animation
	if color_picker_for != "":
		_update_color_picker(delta)

	# Update hit areas
	_update_hit_areas(L)

	# Auto-draw check
	_check_auto_draw()


func _maybe_reflow_hand() -> void:
	var playable := _get_playable_set()
	var h := _dict_hash(playable)
	if hovered_card == prev_hover and h == prev_playable_hash:
		return
	prev_hover = hovered_card
	prev_playable_hash = h
	animator.hover_card_id = hovered_card
	animator.playable_ids = playable
	animator.reflow_local_hand()


func _dict_hash(d: Dictionary) -> int:
	var h := 0
	var keys := d.keys()
	keys.sort()
	for k in keys:
		h = (h * 131 + hash(k)) & 0x7FFFFFFF
	return h


# ── Turn Indicator ──

func _update_turn_indicator(L: Dictionary, delta: float) -> void:
	turn_arrow_node.visible = phase == "playing" and winner == -1
	dir_arrows_node.visible = phase == "playing" and winner == -1

	if not turn_arrow_node.visible:
		return

	var vw: float = L["vw"]
	var vh: float = L["vh"]
	var center := Vector2(vw * 0.5, vh * 0.5)
	var radius := minf(vh * 0.28, vw * 0.32)

	var current_vis_pos := _get_visual_position(current_player)
	var target_angle = PLAYER_ANGLE[current_vis_pos]

	if prev_turn_visual_pos != current_vis_pos:
		var diff = target_angle - turn_arrow_angle
		while diff > PI:
			diff -= TAU
		while diff < -PI:
			diff += TAU
		if absf(diff) < 0.01:
			diff = direction * TAU
		turn_arrow_target = turn_arrow_angle + diff
		prev_turn_visual_pos = current_vis_pos

	# Spring
	var dt := minf(delta, 0.05)
	var acc := 120.0 * (turn_arrow_target - turn_arrow_angle) - 22.0 * turn_arrow_vel
	turn_arrow_vel += acc * dt
	turn_arrow_angle += turn_arrow_vel * dt

	# Draw arrow
	turn_arrow_node.position = center
	turn_arrow_node.rotation = 0
	turn_arrow_node.queue_redraw()

	# Update arrow draw data (we use _draw)
	turn_arrow_node.set_meta("arrow_angle", turn_arrow_angle)
	turn_arrow_node.set_meta("arrow_radius", radius)
	turn_arrow_node.set_meta("arrow_size", radius * 0.15)

	# Direction arrows
	dir_spin += (0.1 if direction == 1 else -0.1) * dt
	dir_arrows_node.position = center
	dir_arrows_node.rotation = dir_spin
	dir_arrows_node.set_meta("radius", radius)
	dir_arrows_node.set_meta("direction", direction)

	# Force redraw if we haven't set up draw callbacks yet
	if not turn_arrow_node.has_meta("draw_connected"):
		turn_arrow_node.set_meta("draw_connected", true)
		turn_arrow_node.draw.connect(func():
			var a: float = turn_arrow_node.get_meta("arrow_angle", 0.0)
			var r: float = turn_arrow_node.get_meta("arrow_radius", 100.0)
			var s: float = turn_arrow_node.get_meta("arrow_size", 15.0)
			var tip := Vector2(cos(a) * r, sin(a) * r)
			var back_angle := a + PI
			var p1 := tip + Vector2(cos(back_angle + 0.4) * s, sin(back_angle + 0.4) * s)
			var p2 := tip + Vector2(cos(back_angle - 0.4) * s, sin(back_angle - 0.4) * s)
			turn_arrow_node.draw_colored_polygon(PackedVector2Array([tip, p1, p2]), Color(1, 1, 1, 0.8))
		)

	if not dir_arrows_node.has_meta("draw_connected"):
		dir_arrows_node.set_meta("draw_connected", true)
		dir_arrows_node.draw.connect(func():
			var r: float = dir_arrows_node.get_meta("radius", 100.0)
			var dir: int = dir_arrows_node.get_meta("direction", 1)
			var s := r * 0.08
			for idx in range(4):
				var a := (float(idx) / 4.0) * TAU + PI / 4.0
				var tangent := a + (PI / 2.0 if dir == 1 else -PI / 2.0)
				var p := Vector2(cos(a) * r * 0.85, sin(a) * r * 0.85)
				var tip := p + Vector2(cos(tangent) * s, sin(tangent) * s)
				var b1 := p + Vector2(cos(tangent + PI + 0.5) * s * 0.6, sin(tangent + PI + 0.5) * s * 0.6)
				var b2 := p + Vector2(cos(tangent + PI - 0.5) * s * 0.6, sin(tangent + PI - 0.5) * s * 0.6)
				dir_arrows_node.draw_colored_polygon(PackedVector2Array([tip, b1, b2]), Color(1, 1, 1, 0.3))
		)

	turn_arrow_node.queue_redraw()
	dir_arrows_node.queue_redraw()


# ── Active Color Ring ──

func _update_color_ring(L: Dictionary, delta: float) -> void:
	ring_group.visible = phase == "playing"
	if not ring_group.visible:
		return

	var vw: float = L["vw"]
	var vh: float = L["vh"]
	var center := Vector2(vw * 0.5, vh * 0.5)
	var pile_x_offset: float = L["pile_x_offset"]
	var discard_pos := Vector2(center.x + pile_x_offset * 2.5, center.y)
	var discard_scale: float = L["discard_scale"]

	var ring_color: Color = COLOR_HEX.get(active_color, Color.WHITE)

	ring_group.position = discard_pos

	# Color change punch animation
	if active_color != prev_active_color:
		prev_active_color = active_color
		ring_group.scale = Vector2.ONE * 1.8
		ring_scale_vel = 0.0

	# Spring ring scale back to 1.0
	var dt := minf(delta, 0.05)
	var cur_s := ring_group.scale.x
	var acc_s := 200.0 * (1.0 - cur_s) - 30.0 * ring_scale_vel
	ring_scale_vel += acc_s * dt
	ring_group.scale = Vector2.ONE * (cur_s + ring_scale_vel * dt)

	# Redraw the ring
	if not ring_group.has_meta("draw_connected"):
		ring_group.set_meta("draw_connected", true)
		ring_group.draw.connect(func():
			var outer_r: float = ring_group.get_meta("outer_radius", 50.0)
			var inner_r: float = ring_group.get_meta("inner_radius", 40.0)
			var col: Color = ring_group.get_meta("ring_color", Color.RED)
			ring_group.draw_circle(Vector2.ZERO, outer_r, col)
			ring_group.draw_circle(Vector2.ZERO, inner_r, FELT_COLOR)
		)

	ring_group.set_meta("outer_radius", 0.62 * discard_scale * 375.0)
	ring_group.set_meta("inner_radius", 0.55 * discard_scale * 375.0)
	ring_group.set_meta("ring_color", ring_color)
	ring_group.queue_redraw()


# ── Color Picker Animation ──

func _update_color_picker(delta: float) -> void:
	var dt := minf(delta, 0.05)
	picker_elapsed += dt

	# Fade overlay
	var acc_o := 200.0 * (0.5 - picker_overlay_alpha) - 30.0 * picker_overlay_vel
	picker_overlay_vel += acc_o * dt
	picker_overlay_alpha += picker_overlay_vel * dt
	picker_overlay.color.a = clampf(picker_overlay_alpha, 0.0, 0.7)

	# Animate circles
	for i in range(picker_circles.size()):
		var circle := picker_circles[i]
		var delay := float(i + 1) * PICKER_STAGGER_MS / 1000.0
		var target := 0.0
		if picker_elapsed > delay:
			if hovered_picker_color == PICKER_COLORS[i]:
				target = 1.3
			else:
				target = 1.0

		var cur := circle.scale.x
		var acc := 200.0 * (target - cur) - 30.0 * picker_circle_vels[i]
		picker_circle_vels[i] += acc * dt
		var new_s := maxf(0.0, cur + picker_circle_vels[i] * dt)
		circle.scale = Vector2.ONE * new_s


# ── Hit Areas ──

func _update_hit_areas(L: Dictionary) -> void:
	var should_show = (
		showcase_card_id == "" and
		color_picker_for == "" and
		current_player == local_seat_index and
		winner == -1
	)

	# Clear old hit areas
	for area in hit_areas:
		area.queue_free()
	hit_areas.clear()

	if not should_show:
		return

	# Use the animator's stable visual order so hit areas line up with where
	# the cards are actually rendered (schema order can shift mid-turn).
	var hand_filtered: Array = animator.get_ordered_local_hand()

	var playable_set := _get_playable_set()
	var vw: float = L["vw"]
	var vh: float = L["vh"]
	var center_x := vw * 0.5
	var bottom_y: float = L["bottom_y"]

	for i in range(hand_filtered.size()):
		var card = hand_filtered[i]
		var cid: String = card.get("id", "")
		var count := hand_filtered.size()
		var mid := (count - 1) / 2.0
		var off := float(i) - mid

		var card_x = center_x + off * L["player_spacing"]
		var card_y := bottom_y - absf(off) * 2.0

		var area := Area2D.new()
		area.position = Vector2(card_x, card_y)
		area.rotation = off * 0.03
		area.z_index = 200
		area.input_pickable = true

		var shape := CollisionShape2D.new()
		var rect_shape := RectangleShape2D.new()
		rect_shape.size = Vector2(L["player_spacing"], L["player_scale"] * 375.0 * 1.2)
		shape.shape = rect_shape
		area.add_child(shape)

		var card_id := cid
		var playable := playable_set.has(card_id)

		area.input_event.connect(func(_viewport, event, _shape_idx):
			if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
				if playable:
					_on_card_clicked(card_id)
		)
		area.mouse_entered.connect(func():
			if playable:
				hovered_card = card_id
		)
		area.mouse_exited.connect(func():
			if hovered_card == card_id:
				hovered_card = ""
		)

		add_child(area)
		hit_areas.append(area)


func _exit_tree() -> void:
	if room and room.connected:
		room.leave()
