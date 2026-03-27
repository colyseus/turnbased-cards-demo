#!/bin/bash
# =============================================================================
# GameMaker Project Generator for UnoGame
# Generates sprite .yy metadata, copies card PNGs, builds .yyp project file
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/UnoGame" && pwd)"
CARDS_DIR="$(cd "$(dirname "$0")/../web-react/public/cards" && pwd)"

echo "Project dir: $PROJECT_DIR"
echo "Cards dir: $CARDS_DIR"

# Generate unique GUIDs
next_guid() {
    uuidgen | tr '[:upper:]' '[:lower:]'
}

# =============================================================================
# Sprite Setup: copy card PNGs and generate .yy files
# =============================================================================

create_card_sprite() {
    local name="$1"
    local src_png="$2"
    local width=240
    local height=375
    local origin_x=120  # center
    local origin_y=187  # center

    local spr_dir="$PROJECT_DIR/sprites/$name"
    mkdir -p "$spr_dir"

    local frame_guid=$(next_guid)
    local layer_guid=$(next_guid)
    local sprite_guid=$(next_guid)

    # Copy PNG as frame
    cp "$src_png" "$spr_dir/$frame_guid.png"

    # Create layer directory and copy PNG there too
    mkdir -p "$spr_dir/layers/$frame_guid"
    cp "$src_png" "$spr_dir/layers/$frame_guid/$layer_guid.png"

    cat > "$spr_dir/$name.yy" <<EOYY
{
  "\$GMSprite":"v2",
  "%Name":"$name",
  "bboxMode":0,
  "bbox_bottom":$((height - 1)),
  "bbox_left":0,
  "bbox_right":$((width - 1)),
  "bbox_top":0,
  "collisionKind":1,
  "collisionTolerance":0,
  "DynamicTexturePage":false,
  "edgeFiltering":false,
  "For3D":false,
  "frames":[
    {"\$GMSpriteFrame":"v1","%Name":"$frame_guid","name":"$frame_guid","resourceType":"GMSpriteFrame","resourceVersion":"2.0"}
  ],
  "gridX":0,
  "gridY":0,
  "height":$height,
  "HTile":false,
  "layers":[
    {"\$GMImageLayer":"","%Name":"$layer_guid","blendMode":0,"displayName":"default","isLocked":false,"name":"$layer_guid","opacity":100.0,"resourceType":"GMImageLayer","resourceVersion":"2.0","visible":true}
  ],
  "name":"$name",
  "nineSlice":null,
  "origin":9,
  "parent":{
    "name":"UnoGame",
    "path":"UnoGame.yyp"
  },
  "preMultiplyAlpha":false,
  "resourceType":"GMSprite",
  "resourceVersion":"2.0",
  "sequence":{
    "\$GMSequence":"v1",
    "%Name":"$name",
    "autoRecord":true,
    "backdropHeight":768,
    "backdropImageOpacity":0.5,
    "backdropImagePath":"",
    "backdropWidth":1366,
    "backdropXOffset":0.0,
    "backdropYOffset":0.0,
    "events":{"\$KeyframeStore<MessageEventKeyframe>":"","Keyframes":[],"resourceType":"KeyframeStore<MessageEventKeyframe>","resourceVersion":"2.0"},
    "eventStubScript":null,
    "eventToFunction":{},
    "length":1.0,
    "lockOrigin":false,
    "moments":{"\$KeyframeStore<MomentsEventKeyframe>":"","Keyframes":[],"resourceType":"KeyframeStore<MomentsEventKeyframe>","resourceVersion":"2.0"},
    "name":"$name",
    "playback":1,
    "playbackSpeed":15.0,
    "playbackSpeedType":0,
    "resourceType":"GMSequence",
    "resourceVersion":"2.0",
    "showBackdrop":true,
    "showBackdropImage":false,
    "timeUnits":1,
    "tracks":[
      {"\$GMSpriteFramesTrack":"","builtinName":0,"events":[],"inheritsTrackColour":true,"interpolation":1,"isCreationTrack":false,"keyframes":{"\$KeyframeStore<SpriteFrameKeyframe>":"","Keyframes":[{"\$Keyframe<SpriteFrameKeyframe>":"","Channels":{"0":{"\$SpriteFrameKeyframe":"","Id":{"name":"$frame_guid","path":"sprites/$name/$name.yy"},"resourceType":"SpriteFrameKeyframe","resourceVersion":"2.0"}},"Disabled":false,"id":"$sprite_guid","IsCreationKey":false,"Key":0.0,"Length":1.0,"resourceType":"Keyframe<SpriteFrameKeyframe>","resourceVersion":"2.0","Stretch":false}],"resourceType":"KeyframeStore<SpriteFrameKeyframe>","resourceVersion":"2.0"},"modifiers":[],"name":"frames","resourceType":"GMSpriteFramesTrack","resourceVersion":"2.0","spriteId":null,"trackColour":0,"tracks":[],"traits":0}
    ],
    "visibleRange":null,
    "volume":1.0,
    "xorigin":$origin_x,
    "yorigin":$origin_y
  },
  "swatchColours":null,
  "swfPrecision":0.5,
  "textureGroupId":{"name":"Default","path":"texturegroups/Default"},
  "type":0,
  "VTile":false,
  "width":$width
}
EOYY
    echo "  Created card sprite: $name"
}

echo ""
echo "=== Creating Card Sprites ==="

# All card texture IDs (matching PNG filenames without extension)
CARD_NAMES=(
    back
    red_0 red_1 red_2 red_3 red_4 red_5 red_6 red_7 red_8 red_9 red_skip red_reverse red_draw2
    blue_0 blue_1 blue_2 blue_3 blue_4 blue_5 blue_6 blue_7 blue_8 blue_9 blue_skip blue_reverse blue_draw2
    green_0 green_1 green_2 green_3 green_4 green_5 green_6 green_7 green_8 green_9 green_skip green_reverse green_draw2
    yellow_0 yellow_1 yellow_2 yellow_3 yellow_4 yellow_5 yellow_6 yellow_7 yellow_8 yellow_9 yellow_skip yellow_reverse yellow_draw2
    wild wild_draw4
)

for card_name in "${CARD_NAMES[@]}"; do
    spr_name="spr_card_${card_name}"
    src_png="$CARDS_DIR/${card_name}.png"
    if [ -f "$src_png" ]; then
        create_card_sprite "$spr_name" "$src_png"
    else
        echo "  WARNING: Missing card PNG: $src_png"
    fi
done

# =============================================================================
# Copy Colyseus SDK extension from tanks demo
# =============================================================================

echo ""
echo "=== Copying Colyseus SDK Extension ==="

TANKS_EXT_DIR="$(cd "$(dirname "$0")/../../realtime-tanks-demo/gamemaker/TankBattle/extensions/Colyseus_SDK" && pwd 2>/dev/null || echo "")"

if [ -d "$TANKS_EXT_DIR" ]; then
    # Copy extension files (but update parent path)
    cp -r "$TANKS_EXT_DIR"/* "$PROJECT_DIR/extensions/Colyseus_SDK/" 2>/dev/null || true

    # Update the .yy parent path
    if [ -f "$PROJECT_DIR/extensions/Colyseus_SDK/Colyseus_SDK.yy" ]; then
        # Replace parent reference to point to UnoGame
        sed -i.bak 's|"name":"TankBattle"|"name":"UnoGame"|g' "$PROJECT_DIR/extensions/Colyseus_SDK/Colyseus_SDK.yy"
        sed -i.bak 's|TankBattle\.yyp|UnoGame.yyp|g' "$PROJECT_DIR/extensions/Colyseus_SDK/Colyseus_SDK.yy"
        rm -f "$PROJECT_DIR/extensions/Colyseus_SDK/Colyseus_SDK.yy.bak"
    fi
    echo "  Copied Colyseus SDK extension"
else
    echo "  WARNING: Could not find tanks demo extension at: $TANKS_EXT_DIR"
    echo "  You will need to add the Colyseus_SDK extension manually."
fi

# =============================================================================
# Generate .yyp Project File
# =============================================================================

echo ""
echo "=== Creating Project File ==="

# Collect all resources
RESOURCES=""
add_resource() {
    local name="$1"
    local path="$2"
    if [ -n "$RESOURCES" ]; then RESOURCES="$RESOURCES,"; fi
    RESOURCES="$RESOURCES
    {\"id\":{\"name\":\"$name\",\"path\":\"$path\"}}"
}

# Extension
add_resource "Colyseus_SDK" "extensions/Colyseus_SDK/Colyseus_SDK.yy"

# Objects
for obj in obj_game obj_lobby obj_card; do
    add_resource "$obj" "objects/$obj/$obj.yy"
done

# Scripts
for scr in Colyseus scr_constants scr_network scr_utils; do
    add_resource "$scr" "scripts/$scr/$scr.yy"
done

# Rooms
add_resource "rm_lobby" "rooms/rm_lobby/rm_lobby.yy"
add_resource "rm_game" "rooms/rm_game/rm_game.yy"

# Sprites
for card_name in "${CARD_NAMES[@]}"; do
    spr_name="spr_card_${card_name}"
    add_resource "$spr_name" "sprites/$spr_name/$spr_name.yy"
done

cat > "$PROJECT_DIR/UnoGame.yyp" <<EOYY
{
  "\$GMProject":"v1",
  "%Name":"UnoGame",
  "AudioGroups":[
    {"\$GMAudioGroup":"v1","%Name":"audiogroup_default","exportDir":"","name":"audiogroup_default","resourceType":"GMAudioGroup","resourceVersion":"2.0","targets":-1}
  ],
  "configs":{
    "children":[],
    "name":"Default"
  },
  "defaultScriptType":0,
  "Folders":[],
  "ForcedPrefabProjectReferences":[],
  "IncludedFiles":[],
  "isEcma":false,
  "LibraryEmitters":[],
  "MetaData":{
    "IDEVersion":"2024.14.3.217"
  },
  "name":"UnoGame",
  "resources":[$RESOURCES
  ],
  "resourceType":"GMProject",
  "resourceVersion":"2.0",
  "RoomOrderNodes":[
    {"roomId":{"name":"rm_lobby","path":"rooms/rm_lobby/rm_lobby.yy"}},
    {"roomId":{"name":"rm_game","path":"rooms/rm_game/rm_game.yy"}}
  ],
  "templateType":"game",
  "TextureGroups":[
    {"\$GMTextureGroup":"","%Name":"Default","autocrop":true,"border":2,"compressFormat":"bz2","customOptions":"","directory":"","groupParent":null,"isScaled":true,"loadType":"default","mipsToGenerate":0,"name":"Default","resourceType":"GMTextureGroup","resourceVersion":"2.0","targets":-1}
  ]
}
EOYY

echo "  Created: UnoGame.yyp"
echo ""
echo "=== Done! ==="
echo "Open UnoGame.yyp in GameMaker to start the project."
echo ""
echo "The card_sprites global map is populated in the game init."
echo "Ensure the Colyseus_SDK extension is properly linked."
