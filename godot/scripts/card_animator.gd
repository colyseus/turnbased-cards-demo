class_name CardAnimator
extends Node2D

## Owns all card entities; translates UNO game events into Tween animations.
## Entities have stable identity so they persist through state transitions.
##
## Key scheme:
##   "card:<card_id>"        — real card (local hand, discard)
##   "opp:<seat>:<slot>"     — opponent face-down card (slot is a monotonic counter)
##   "draw:<i>"              — visual draw-pile stack card (no animation, just depth)

const PLAY_DUR := 0.45
const DRAW_DUR := 0.45
const REFLOW_DUR := 0.22
const HOVER_DUR := 0.15
const EXIT_DUR := 0.25
const DRAW_STAGGER := 0.06

# ── External references ──
var game: Node  # game.gd, used for layout/texture helpers
var cards_parent: Node2D
var textures: Dictionary = {}  # tid -> Texture2D
var back_texture: Texture2D

# ── State ──
var entities: Dictionary = {}  # key -> CardEntity

# Entities currently exiling to the draw pile (reshuffle tween). Tracked
# separately because they've been removed from `entities` so reflow ignores
# them — but we still need to find them by card_id if the same card is
# immediately redealt so we can kill the dying entity instead of letting it
# overlap with the new draw animation. See _cancel_exile_for.
var exiting_by_id: Dictionary = {}  # card_id -> CardEntity

# Opponent slot queues (FIFO). A slot represents a physical card position;
# when handCount decreases we pop the tail (most-recently drawn).
var opp_slots: Dictionary = {}  # seat(int) -> Array[String] of entity keys
var _slot_counter: int = 0

# Draw-pile visual stack
var draw_stack_count: int = 0

# Input from game.gd (for hover/playable reflow)
var hover_card_id: String = ""
var playable_ids: Dictionary = {}  # card_id -> true
var showcase_card_id: String = ""

# Stable visual hand order. Keyed by card id → monotonic sequence.
# The client-side ArraySchema order can shift when plays+draws happen in the
# same tick (splice then push), putting newly-drawn cards in the middle of
# the hand. We ignore schema order for display and instead order by when we
# first saw each card — so drawn cards always land at the right end.
var _hand_seq: Dictionary = {}
var _next_hand_seq: int = 0


func setup(p_game: Node, p_cards_parent: Node2D, p_textures: Dictionary, p_back_texture: Texture2D) -> void:
	game = p_game
	cards_parent = p_cards_parent
	textures = p_textures
	back_texture = p_back_texture


# ── Entity helpers ──

func _key_card(card_id: String) -> String:
	return "card:" + card_id

func _key_opp(seat: int, slot: int) -> String:
	return "opp:%d:%d" % [seat, slot]

func _key_draw(i: int) -> String:
	return "draw:%d" % i

func _new_entity(key: String) -> CardEntity:
	var e := CardEntity.new()
	e.card_id = key
	e.back_texture = back_texture
	cards_parent.add_child(e)
	entities[key] = e
	return e

func _remove_entity(key: String) -> void:
	if entities.has(key):
		var e: CardEntity = entities[key]
		entities.erase(key)
		if is_instance_valid(e):
			e.queue_free()

func _get_front_tex(tid: String) -> Texture2D:
	return textures.get(tid, back_texture)


# ── Initial snapshot ──

func snap_from_state(state, local_seat: int) -> void:
	clear_all()
	var L: Dictionary = game._compute_layout()

	# Discard pile — snap existing cards.
	var discard: Array = game._get_discard_pile()
	for i in range(discard.size()):
		var card = discard[i]
		var cid: String = card.get("id", "")
		var tid: String = game._card_texture_from_schema(card)
		var pose := _discard_pose(i, discard.size(), L, cid)
		var e := _new_entity(_key_card(cid))
		e.set_face(tid, _get_front_tex(tid), true)
		e.snap_to(pose["pos"], pose["rot"], pose["scl"])
		e.set_z(pose["z"])

	# Local hand
	var local_hand: Array = get_ordered_local_hand()
	for i in range(local_hand.size()):
		var card = local_hand[i]
		var cid: String = card.get("id", "")
		var tid: String = game._card_texture_from_schema(card)
		var pose := _hand_pose(i, local_hand.size(), L, false)
		var e := _new_entity(_key_card(cid))
		e.set_face(tid, _get_front_tex(tid), true)
		e.snap_to(pose["pos"], pose["rot"], pose["scl"])
		e.set_z(pose["z"] + i)

	# Opponent hands (face-down)
	var players: Dictionary = game._get_players()
	for key in players.keys():
		var p = players[key]
		if p == null: continue
		var seat: int = p.get("seatIndex", 0)
		if seat == local_seat: continue
		var hand_count: int = p.get("handCount", 0)
		opp_slots[seat] = []
		for ci in range(hand_count):
			_spawn_opp_slot(seat, ci, hand_count, L, true)

	# Draw pile
	draw_stack_count = int(state.get("drawPileCount", 0))
	_rebuild_draw_stack(L)


## Full wipe — used by `snap_from_state` before a fresh snapshot.
func clear_all() -> void:
	for key in entities:
		var e: CardEntity = entities[key]
		if is_instance_valid(e):
			e.queue_free()
	entities.clear()
	opp_slots.clear()
	_slot_counter = 0
	draw_stack_count = 0
	_reset_hand_seq()
	_drain_exiting()


## Drop every `card:*` entity (local hand + discard) and reset visual-order
## state. Called on round restart before new-round hand/discard items arrive
## because the Colyseus SDK doesn't fire hand `on_remove` reliably across a
## full `splice(0, len)` + reassign cycle — mirrors the GameMaker client's
## `restart_hand_clear_pending` pattern.
func clear_card_entities() -> void:
	for key in entities.keys().filter(func(k): return (k as String).begins_with("card:")):
		var e: CardEntity = entities[key]
		if is_instance_valid(e):
			e.queue_free()
		entities.erase(key)
	_reset_hand_seq()
	_drain_exiting()


func _reset_hand_seq() -> void:
	_hand_seq.clear()
	_next_hand_seq = 0


func _drain_exiting() -> void:
	for key in exiting_by_id.keys():
		var ex: CardEntity = exiting_by_id[key]
		if is_instance_valid(ex):
			ex.queue_free()
	exiting_by_id.clear()


# Return the local hand filtered for visible cards and sorted by the animator's
# stable visual order. Cards seen for the first time get the next sequence.
# IMPORTANT: a card that is simultaneously present in local_hand and
# discard_pile is transiently in both because the Colyseus SDK fires
# `discard on_add` before `hand on_remove` for a local play. Discard wins —
# we exclude such cards from hand rendering, mirroring the `_placed` dict
# precedence used in the GameMaker implementation (obj_game/Step_0.gml:339).
func get_ordered_local_hand() -> Array:
	var hand: Array = game._get_local_hand()
	var discard_ids: Dictionary = {}
	for c in game._get_discard_pile():
		discard_ids[c.get("id", "")] = true
	var filtered: Array = []
	for card in hand:
		var cid: String = card.get("id", "")
		if cid == "" or cid == showcase_card_id or discard_ids.has(cid):
			continue
		if not _hand_seq.has(cid):
			_hand_seq[cid] = _next_hand_seq
			_next_hand_seq += 1
		filtered.append(card)
	filtered.sort_custom(func(a, b):
		return _hand_seq.get(a.get("id", ""), 0) < _hand_seq.get(b.get("id", ""), 0)
	)
	# Garbage-collect sequences for cards no longer in hand.
	var present: Dictionary = {}
	for c in filtered:
		present[c.get("id", "")] = true
	for k in _hand_seq.keys():
		if not present.has(k):
			_hand_seq.erase(k)
	return filtered


# ── Events ──

## A card was added to the discard pile (someone played it).
func on_card_played(card, from_seat: int, is_local: bool) -> void:
	var L: Dictionary = game._compute_layout()
	var cid: String = card.get("id", "")
	var tid: String = game._card_texture_from_schema(card)
	var key := _key_card(cid)
	var discard_size: int = game._get_discard_pile().size()
	var target := _discard_pose(0, max(discard_size, 1), L, cid)

	var e: CardEntity
	if is_local and entities.has(key):
		# Reuse the local hand entity — it's already face-up at hand position.
		e = entities[key]
		e.set_z(200)  # above others during flight
		e.shake_enabled = false  # it's no longer in the hand
		# busy=true so any reflow_local_hand that fires while local_hand still
		# transiently contains this card (hand on_remove may fire AFTER
		# discard on_add depending on SDK patch ordering) won't yank it back
		# to the hand position.
		e.tween_to(target["pos"], target["rot"], target["scl"], PLAY_DUR, 0.0, true)
	else:
		# Opponent: reuse one of their face-down slot entities (tail = most recent).
		var slots: Array = opp_slots.get(from_seat, [])
		if slots.size() > 0:
			var opp_key: String = slots.pop_back()
			opp_slots[from_seat] = slots
			e = entities.get(opp_key)
			if e:
				entities.erase(opp_key)
				entities[key] = e
				e.card_id = key
				e.set_z(200)
				e.tween_to_with_flip(target["pos"], target["rot"], target["scl"], tid, _get_front_tex(tid), true, PLAY_DUR)
			else:
				e = _spawn_played_from_hand_center(key, tid, from_seat, L, target)
		else:
			e = _spawn_played_from_hand_center(key, tid, from_seat, L, target)


func _spawn_played_from_hand_center(key: String, tid: String, from_seat: int, L: Dictionary, target: Dictionary) -> CardEntity:
	# Fallback: spawn at seat hand center, fly to discard.
	var local_seat: int = game.local_seat_index
	var vis_pos := ((from_seat - local_seat) + 4) % 4
	var start_pos := _hand_center(vis_pos, L)
	var e := _new_entity(key)
	e.set_face(tid, _get_front_tex(tid), false)
	e.snap_to(start_pos, 0.0, L["discard_scale"])
	e.set_z(200)
	e.tween_to_with_flip(target["pos"], target["rot"], target["scl"], tid, _get_front_tex(tid), true, PLAY_DUR)
	return e


## Snap a newly-added discard card into place without a play animation.
## Used for the initial starting card (fresh game or post-restart).
func place_discard_card(card) -> void:
	var L: Dictionary = game._compute_layout()
	var cid: String = card.get("id", "")
	if entities.has(_key_card(cid)):
		return  # dedup: retroactive callback on already-seeded card
	var tid: String = game._card_texture_from_schema(card)
	var discard_size: int = game._get_discard_pile().size()
	var pose := _discard_pose(0, max(discard_size, 1), L, cid)
	var e := _new_entity(_key_card(cid))
	e.set_face(tid, _get_front_tex(tid), true)
	e.snap_to(pose["pos"], pose["rot"], pose["scl"])
	e.set_z(pose["z"])


## Remove a card from the local hand immediately. Two cases to distinguish:
##  1. Scenario-B local play: discard on_add fired first, on_card_played
##     reused the entity and started a (busy) tween to discard. We must NOT
##     free it — the entity IS the discard visual. Detect by checking if the
##     card ID is currently in discard_pile.
##  2. Everything else (restart clears, stray removal, normal scenario-A play
##     where we were already freed earlier): drop the entity regardless of
##     busy state so stale hand entities don't linger across round restarts.
func remove_local_card(card_id: String) -> void:
	var key := _key_card(card_id)
	if not entities.has(key):
		return
	for c in game._get_discard_pile():
		if c.get("id", "") == card_id:
			return  # flying to discard — let on_card_played's tween finish
	_remove_entity(key)


## A single discard card was removed (reshuffle or restart).
func exile_discard_card(card_id: String) -> void:
	var key := _key_card(card_id)
	if not entities.has(key):
		return
	var e: CardEntity = entities[key]
	if e == null or e.is_exiting():
		return
	var L: Dictionary = game._compute_layout()
	var draw_pos := _draw_pile_pos(L)
	entities.erase(key)
	exiting_by_id[card_id] = e
	e.tween_exit(draw_pos, EXIT_DUR)
	e.tree_exited.connect(func(): exiting_by_id.erase(card_id))


## Kill any in-flight exile animation for this card_id so a subsequent draw
## of the same card doesn't visually overlap with the dying exile entity.
## Without this, recycled discard cards that are immediately redealt look
## like they're flying back from discard to hand.
func _cancel_exile_for(card_id: String) -> void:
	if not exiting_by_id.has(card_id):
		return
	var e: CardEntity = exiting_by_id[card_id]
	exiting_by_id.erase(card_id)
	if is_instance_valid(e):
		e.queue_free()


## Remove an opponent's tail slot entity without animation.
## Used when opponent handCount decreases without a play (shouldn't normally
## happen, but covers restart/edge cases where slots must be dropped).
func remove_opponent_tail_slot(seat: int) -> void:
	var slots: Array = opp_slots.get(seat, [])
	if slots.size() == 0:
		return
	var opp_key: String = slots.pop_back()
	opp_slots[seat] = slots
	if entities.has(opp_key):
		_remove_entity(opp_key)


## Public wrapper to rebuild the draw-pile stack visual.
func rebuild_draw_stack() -> void:
	var L: Dictionary = game._compute_layout()
	_rebuild_draw_stack(L)


## Local player drew a card.
func on_local_card_drawn(card) -> void:
	var L: Dictionary = game._compute_layout()
	var cid: String = card.get("id", "")
	var tid: String = game._card_texture_from_schema(card)
	var key := _key_card(cid)
	if entities.has(key):
		return  # already exists (shouldn't happen)
	# If this card is currently being exiled (reshuffle → immediate redeal),
	# kill the dying entity so the new draw doesn't visually overlap with it.
	_cancel_exile_for(cid)

	var start_pos := _draw_pile_pos(L)
	var e := _new_entity(key)
	e.set_face(tid, _get_front_tex(tid), false)
	e.snap_to(start_pos, 0.0, L["pile_scale"])
	e.set_z(150)
	# get_ordered_local_hand() registers the new card at the tail of the visual order.
	var ordered: Array = get_ordered_local_hand()
	var visible_count := ordered.size()
	var visible_idx := _index_in(ordered, cid)
	var pose := _hand_pose(visible_idx, visible_count, L, false)
	if playable_ids.has(cid):
		pose["pos"].y -= L["hover_lift"] * 0.35
	e.tween_to_with_flip(pose["pos"], pose["rot"], pose["scl"], tid, _get_front_tex(tid), true, DRAW_DUR)

	# Reposition siblings to the new layout (using the new hand size). Since
	# `ordered` came from get_ordered_local_hand() which already excludes
	# cards also on discard, mid-play entities won't appear here — only mid-
	# draw flips from simultaneous on_local_card_drawn calls.
	for i in range(visible_count):
		var other = ordered[i]
		var other_id: String = other.get("id", "")
		if other_id == cid:
			continue
		var oe: CardEntity = entities.get(_key_card(other_id))
		if oe == null or oe.is_exiting():
			continue
		var is_hover_other := (other_id == hover_card_id) and playable_ids.has(other_id)
		var other_pose := _hand_pose(i, visible_count, L, is_hover_other)
		if playable_ids.has(other_id) and not is_hover_other:
			other_pose["pos"].y -= L["hover_lift"] * 0.35
		if oe.is_busy():
			var other_tid: String = game._card_texture_from_schema(other)
			oe.retarget_face_up(other_pose["pos"], other_pose["rot"], other_pose["scl"], REFLOW_DUR, _get_front_tex(other_tid))
		else:
			oe.tween_to(other_pose["pos"], other_pose["rot"], other_pose["scl"], REFLOW_DUR)
		oe.set_z(other_pose["z"] + i + (10 if is_hover_other else 0))


func _index_in(arr: Array, cid: String) -> int:
	for i in range(arr.size()):
		if arr[i].get("id", "") == cid:
			return i
	return 0


## Opponent drew N cards.
func on_opponent_drew(seat: int, count: int, final_hand_count: int) -> void:
	var L: Dictionary = game._compute_layout()
	var start := final_hand_count - count
	for i in range(count):
		var ci := start + i
		_spawn_opp_slot(seat, ci, final_hand_count, L, false, DRAW_STAGGER * float(i))


func _spawn_opp_slot(seat: int, index_in_hand: int, hand_count: int, L: Dictionary, snap: bool, delay: float = 0.0) -> void:
	_slot_counter += 1
	var key := _key_opp(seat, _slot_counter)
	if not opp_slots.has(seat):
		opp_slots[seat] = []
	(opp_slots[seat] as Array).append(key)

	var pose := _opponent_pose(seat, index_in_hand, hand_count, L)
	var e := _new_entity(key)
	e.set_face("back", back_texture, false)
	if snap:
		e.snap_to(pose["pos"], pose["rot"], pose["scl"])
		e.set_z(pose["z"])
	else:
		var draw_pos := _draw_pile_pos(L)
		e.snap_to(draw_pos, 0.0, L["pile_scale"])
		e.set_z(pose["z"])
		e.tween_to(pose["pos"], pose["rot"], pose["scl"], DRAW_DUR, delay, true)


## Called after events to flow all hands into their final layout.
func reflow_all() -> void:
	var L: Dictionary = game._compute_layout()
	reflow_local_hand(L)
	reflow_opponent_hands(L)
	reflow_discard(L)
	_rebuild_draw_stack(L)


func reflow_local_hand(L: Dictionary = {}) -> void:
	if L.is_empty():
		L = game._compute_layout()
	# get_ordered_local_hand() already excludes cards that are also in the
	# discard pile, so mid-play entities don't reach this loop.
	var local_hand: Array = get_ordered_local_hand()
	var count := local_hand.size()
	for i in range(count):
		var card = local_hand[i]
		var cid: String = card.get("id", "")
		var e: CardEntity = entities.get(_key_card(cid))
		if e == null or e.is_exiting():
			continue
		var is_hover := (cid == hover_card_id) and playable_ids.has(cid)
		var pose := _hand_pose(i, count, L, is_hover)
		if playable_ids.has(cid) and not is_hover:
			pose["pos"].y -= L["hover_lift"] * 0.35
		if e.is_busy():
			# Mid-draw: retarget to final pose (count may have grown).
			var tid: String = game._card_texture_from_schema(card)
			e.retarget_face_up(pose["pos"], pose["rot"], pose["scl"], HOVER_DUR, _get_front_tex(tid))
		else:
			e.tween_to(pose["pos"], pose["rot"], pose["scl"], HOVER_DUR)
		e.set_z(pose["z"] + i + (10 if is_hover else 0))
		e.shake_enabled = (count == 1) and _winner_is_none()


func reflow_opponent_hands(L: Dictionary = {}) -> void:
	if L.is_empty():
		L = game._compute_layout()
	var players: Dictionary = game._get_players()
	var local_seat: int = game.local_seat_index
	for key in players.keys():
		var p = players[key]
		if p == null: continue
		var seat: int = p.get("seatIndex", 0)
		if seat == local_seat: continue
		var slots: Array = opp_slots.get(seat, [])
		var count := slots.size()
		for i in range(count):
			var k: String = slots[i]
			var e: CardEntity = entities.get(k)
			if e == null or e.is_exiting() or e.is_busy(): continue
			var pose := _opponent_pose(seat, i, count, L)
			e.tween_to(pose["pos"], pose["rot"], pose["scl"], REFLOW_DUR)
			e.set_z(pose["z"] + i)
			e.shake_enabled = (count == 1) and _winner_is_none()


func reflow_discard(L: Dictionary = {}) -> void:
	if L.is_empty():
		L = game._compute_layout()
	var discard: Array = game._get_discard_pile()
	for i in range(discard.size()):
		var card = discard[i]
		var cid: String = card.get("id", "")
		var key := _key_card(cid)
		var e: CardEntity = entities.get(key)
		if e == null or e.is_exiting() or e.is_busy(): continue
		var pose := _discard_pose(i, discard.size(), L, cid)
		# Top card (i == 0) is the just-played card; its own tween is running, so don't
		# override its position or z-index.
		if i > 0:
			e.tween_to(pose["pos"], pose["rot"], pose["scl"], REFLOW_DUR)
			e.set_z(pose["z"])


func _rebuild_draw_stack(L: Dictionary) -> void:
	var visible_count := mini(draw_stack_count, 8)
	# Remove extras
	for i in range(visible_count, 8):
		_remove_entity(_key_draw(i))
	# Upsert
	var draw_pos := _draw_pile_pos(L)
	for i in range(visible_count):
		var key := _key_draw(i)
		var depth := 0.0
		if visible_count > 1:
			depth = float(visible_count - 1 - i) / float(visible_count - 1)
		var pos := Vector2(
			draw_pos.x + depth * L["pile_scale"] * 375.0 * 0.06,
			draw_pos.y - depth * L["pile_scale"] * 375.0 * 0.12
		)
		var e: CardEntity = entities.get(key)
		if e == null:
			e = _new_entity(key)
			e.set_face("back", back_texture, false)
			e.snap_to(pos, 0.0, L["pile_scale"])
		else:
			e.tween_to(pos, 0.0, L["pile_scale"], REFLOW_DUR)
		e.set_z(i)


# ── Pose helpers ──

func _hand_pose(i: int, count: int, L: Dictionary, is_hover: bool) -> Dictionary:
	var vw: float = L["vw"]
	var center_x := vw * 0.5
	var bottom_y: float = L["bottom_y"]
	var mid := (count - 1) / 2.0
	var off := float(i) - mid
	var y := bottom_y - absf(off) * 2.0
	if is_hover:
		y = bottom_y - L["hover_lift"]
	var scl: float = L["player_hover_scale"] if is_hover else L["player_scale"]
	return {
		"pos": Vector2(center_x + off * L["player_spacing"], y),
		"rot": off * 0.03,
		"scl": scl,
		"z": 100,
	}


func _opponent_pose(seat: int, i: int, count: int, L: Dictionary) -> Dictionary:
	var vw: float = L["vw"]
	var vh: float = L["vh"]
	var center := Vector2(vw * 0.5, vh * 0.5)
	var local_seat: int = game.local_seat_index
	var vis_pos := ((seat - local_seat) + 4) % 4
	var mid := (count - 1) / 2.0
	var off := float(i) - mid
	var pos := Vector2.ZERO
	var rot := 0.0
	if vis_pos == 1:
		pos = Vector2(L["side_x"] * 0.15, L["side_y_offset"] + off * L["v_spacing"])
		rot = PI / 2.0
	elif vis_pos == 2:
		pos = Vector2(center.x + off * L["h_spacing"], L["top_y"])
	elif vis_pos == 3:
		pos = Vector2(vw - L["side_x"] * 0.15, L["side_y_offset"] + off * L["v_spacing"])
		rot = -PI / 2.0
	return {"pos": pos, "rot": rot, "scl": L["opponent_scale"], "z": 10}


func _discard_pose(i: int, total: int, L: Dictionary, id: String) -> Dictionary:
	var vw: float = L["vw"]
	var vh: float = L["vh"]
	var center := Vector2(vw * 0.5, vh * 0.5)
	var pile_x_offset: float = L["pile_x_offset"]
	var discard_pos := Vector2(center.x + pile_x_offset * 2.5, center.y)
	var scatter_x := float(((i * 13) % 7) - 3) * 2.0
	var scatter_y := float(((i * 7) % 5) - 2) * 2.0
	return {
		"pos": Vector2(discard_pos.x + scatter_x, discard_pos.y + scatter_y),
		"rot": game._hash_rotation(id, i),
		"scl": L["discard_scale"],
		"z": 50 + (total - 1 - i),
	}


func _draw_pile_pos(L: Dictionary) -> Vector2:
	var vw: float = L["vw"]
	var vh: float = L["vh"]
	var center := Vector2(vw * 0.5, vh * 0.5)
	var pile_x_offset: float = L["pile_x_offset"]
	return Vector2(center.x - pile_x_offset * 2.5, center.y)


func _hand_center(vis_pos: int, L: Dictionary) -> Vector2:
	var vw: float = L["vw"]
	var vh: float = L["vh"]
	var center := Vector2(vw * 0.5, vh * 0.5)
	match vis_pos:
		0: return Vector2(center.x, L["bottom_y"])
		1: return Vector2(L["side_x"] * 0.15, L["side_y_offset"])
		2: return Vector2(center.x, L["top_y"])
		3: return Vector2(vw - L["side_x"] * 0.15, L["side_y_offset"])
	return center


func _winner_is_none() -> bool:
	return game.winner == -1


# ── Showcase (big card display on click) ──

func set_showcase(card_id: String) -> void:
	showcase_card_id = card_id
	if card_id == "":
		reflow_local_hand()
		return
	var key := _key_card(card_id)
	var e: CardEntity = entities.get(key)
	if e == null or e.is_exiting(): return
	var L: Dictionary = game._compute_layout()
	var vw: float = L["vw"]
	var vh: float = L["vh"]
	e.set_z(250)
	e.tween_to(Vector2(vw * 0.5, vh * 0.5), 0.0, L["showcase_scale"], REFLOW_DUR)
	reflow_local_hand(L)
