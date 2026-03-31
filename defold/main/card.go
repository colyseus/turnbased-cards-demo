embedded_components {
  id: "front"
  type: "sprite"
  data: "default_animation: \"back\"\n"
  "material: \"/builtins/materials/sprite.material\"\n"
  "textures {\n"
  "  sampler: \"texture_sampler\"\n"
  "  texture: \"/gfx/cards.atlas\"\n"
  "}\n"
  position {
    x: 0.0
    y: 0.0
    z: 0.005
  }
  scale {
    x: 1.0
    y: 1.0
    z: 1.0
  }
}
embedded_components {
  id: "back"
  type: "sprite"
  data: "default_animation: \"back\"\n"
  "material: \"/builtins/materials/sprite.material\"\n"
  "textures {\n"
  "  sampler: \"texture_sampler\"\n"
  "  texture: \"/gfx/cards.atlas\"\n"
  "}\n"
  position {
    x: 0.0
    y: 0.0
    z: -0.005
  }
  scale {
    x: 1.0
    y: 1.0
    z: 1.0
  }
}
