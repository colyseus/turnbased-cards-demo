class_name CardEntity
extends Node2D

## Single UNO card entity. One Sprite2D, Tween-based animations.
## Flip is done via scale.x going to 0 then back, with a texture swap at the midpoint.

const CARD_ASPECT := 240.0 / 375.0

var sprite: Sprite2D

# Identity
var card_id: String = ""
var texture_id: String = ""
var face_up: bool = false

# Shared back texture
var back_texture: Texture2D

# Tween state
var _tweens: Array[Tween] = []
var _exiting: bool = false
var _busy: bool = false  # set during play/draw flip; reflow skips busy cards

# Continuous shake (driven from _process, not a tween)
var shake_enabled: bool = false
var _shake_time: float = 0.0
var _base_rot: float = 0.0
var _shake_offset_rot: float = 0.0


func _init() -> void:
	sprite = Sprite2D.new()
	sprite.centered = true


func _ready() -> void:
	add_child(sprite)


func _process(delta: float) -> void:
	if shake_enabled:
		_shake_time += delta
		var new_offset := sin(_shake_time * 22.0) * 0.06 + sin(_shake_time * 37.0) * 0.03
		rotation += new_offset - _shake_offset_rot
		_shake_offset_rot = new_offset
	elif _shake_offset_rot != 0.0:
		rotation -= _shake_offset_rot
		_shake_offset_rot = 0.0


func set_back_texture(tex: Texture2D) -> void:
	back_texture = tex
	if sprite and not face_up:
		sprite.texture = tex


func set_face(tid: String, front_tex: Texture2D, up: bool) -> void:
	texture_id = tid
	face_up = up
	if sprite:
		sprite.texture = front_tex if up else back_texture


func snap_to(pos: Vector2, rot: float, scl: float) -> void:
	_kill_tweens()
	position = pos
	rotation = rot
	scale = Vector2.ONE * scl
	_base_rot = rot
	_shake_offset_rot = 0.0


func tween_to(pos: Vector2, rot: float, scl: float, dur: float = 0.35, delay: float = 0.0, busy: bool = false) -> void:
	if _exiting:
		return
	_kill_tweens()
	_base_rot = rot
	_busy = busy
	var t := create_tween()
	t.set_parallel(true)
	t.set_trans(Tween.TRANS_CUBIC)
	t.set_ease(Tween.EASE_OUT)
	if delay > 0.0:
		t.tween_property(self, "position", pos, dur).set_delay(delay)
		t.tween_property(self, "rotation", rot, dur).set_delay(delay)
		t.tween_property(self, "scale", Vector2.ONE * scl, dur).set_delay(delay)
	else:
		t.tween_property(self, "position", pos, dur)
		t.tween_property(self, "rotation", rot, dur)
		t.tween_property(self, "scale", Vector2.ONE * scl, dur)
	if busy:
		t.finished.connect(func(): _busy = false)
	_tweens.append(t)


## Animate to pose AND flip to a target face/texture. Texture swaps at midpoint.
func tween_to_with_flip(pos: Vector2, rot: float, scl: float, target_tid: String, target_front_tex: Texture2D, up: bool, dur: float = 0.45) -> void:
	if _exiting:
		return
	_kill_tweens()
	_base_rot = rot
	_busy = true
	var half := dur * 0.5

	# Movement tween (position/rotation/scale over full duration, in parallel).
	var move := create_tween()
	move.set_parallel(true)
	move.set_trans(Tween.TRANS_CUBIC)
	move.set_ease(Tween.EASE_OUT)
	move.tween_property(self, "position", pos, dur)
	move.tween_property(self, "rotation", rot, dur)
	move.tween_property(self, "scale", Vector2.ONE * scl, dur)
	move.finished.connect(func(): _busy = false)
	_tweens.append(move)

	# Flip tween (scale.x goes 1 → 0 → 1 with texture swap at zero).
	var flip := create_tween()
	flip.tween_property(sprite, "scale:x", 0.0, half).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	flip.tween_callback(func():
		texture_id = target_tid
		face_up = up
		sprite.texture = target_front_tex if up else back_texture
	)
	flip.tween_property(sprite, "scale:x", 1.0, half).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_tweens.append(flip)


func is_busy() -> bool:
	return _busy


## Redirect a card that is mid-flight (e.g., another draw arrived and the
## final hand position has shifted). Kills the existing tween chain cleanly,
## restores face-up state in case the flip was mid-scale when interrupted,
## then tweens to the new pose. Callers pass the front texture so the sprite
## can be forced to the correct face.
func retarget_face_up(pos: Vector2, rot: float, scl: float, dur: float, front_tex: Texture2D) -> void:
	if _exiting:
		return
	_kill_tweens()
	# Restore from any partial flip state.
	if sprite:
		sprite.scale.x = 1.0
		sprite.texture = front_tex
	face_up = true
	_base_rot = rot
	_busy = true
	var t := create_tween()
	t.set_parallel(true)
	t.set_trans(Tween.TRANS_CUBIC)
	t.set_ease(Tween.EASE_OUT)
	t.tween_property(self, "position", pos, dur)
	t.tween_property(self, "rotation", rot, dur)
	t.tween_property(self, "scale", Vector2.ONE * scl, dur)
	t.finished.connect(func(): _busy = false)
	_tweens.append(t)


## Fly to a target and free. Used when a card leaves the board (e.g., reshuffle).
func tween_exit(target_pos: Vector2, dur: float = 0.3) -> void:
	if _exiting:
		return
	_exiting = true
	_kill_tweens()
	var t := create_tween()
	t.set_parallel(true)
	t.tween_property(self, "position", target_pos, dur).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	t.tween_property(self, "scale", Vector2.ZERO, dur).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	t.tween_property(self, "modulate:a", 0.0, dur)
	t.chain().tween_callback(func(): queue_free())
	_tweens.append(t)


func set_z(idx: int) -> void:
	z_index = idx


func is_exiting() -> bool:
	return _exiting


func _kill_tweens() -> void:
	for t in _tweens:
		if t and t.is_valid():
			t.kill()
	_tweens.clear()
	_busy = false


func get_card_size() -> Vector2:
	if sprite and sprite.texture:
		return sprite.texture.get_size() * scale
	return Vector2(240, 375) * scale
