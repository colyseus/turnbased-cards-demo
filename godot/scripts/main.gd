extends Control

## Main scene controller — switches between Lobby and Game scenes.
## Root is a Control (anchored to the full viewport) so that anchor-based
## children (the Lobby) resolve against a real rect on all platforms,
## including the HTML5 export where canvas sizing is asynchronous.

var lobby_scene: Control
var game_scene: Node2D
var hud_scene: CanvasLayer

var room: Variant = null  # ColyseusRoom


func _ready() -> void:
	_show_lobby()


func _show_lobby() -> void:
	# Clean up existing scenes
	if game_scene:
		game_scene.queue_free()
		game_scene = null
	if hud_scene:
		hud_scene.queue_free()
		hud_scene = null

	# Create lobby
	lobby_scene = preload("res://scenes/lobby.tscn").instantiate()
	lobby_scene.joined.connect(_on_joined)
	add_child(lobby_scene)


func _on_joined(_client: Variant, p_room: Variant) -> void:
	room = p_room

	# Remove lobby
	if lobby_scene:
		lobby_scene.queue_free()
		lobby_scene = null

	# Create game
	game_scene = preload("res://scenes/game.tscn").instantiate()
	game_scene.setup(room)
	add_child(game_scene)

	# Create HUD
	hud_scene = preload("res://scenes/hud.tscn").instantiate()
	hud_scene.setup(room)
	add_child(hud_scene)
