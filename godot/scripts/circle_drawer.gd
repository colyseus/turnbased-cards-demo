class_name CircleDrawer
extends Node2D

## Draws a filled circle. Used for color picker circles.

var circle_radius: float = 35.0
var circle_color: Color = Color.WHITE


func _draw() -> void:
	draw_circle(Vector2.ZERO, circle_radius, circle_color)
