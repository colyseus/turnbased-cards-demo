#!/bin/bash
FILES="red_0.png red_1.png red_2.png red_3.png red_4.png red_5.png red_6.png red_7.png red_8.png red_9.png red_skip.png red_reverse.png red_draw2.png blue_0.png blue_1.png blue_2.png blue_3.png blue_4.png blue_5.png blue_6.png blue_7.png blue_8.png blue_9.png blue_skip.png blue_reverse.png blue_draw2.png green_0.png green_1.png green_2.png green_3.png green_4.png green_5.png green_6.png green_7.png green_8.png green_9.png green_skip.png green_reverse.png green_draw2.png yellow_0.png yellow_1.png yellow_2.png yellow_3.png yellow_4.png yellow_5.png yellow_6.png yellow_7.png yellow_8.png yellow_9.png yellow_skip.png yellow_reverse.png yellow_draw2.png wild.png wild_draw4.png back.png"
LIST_FILE="web-react/public/cards/list.txt"
rm -f $LIST_FILE
for f in $FILES; do
  echo "file '$(pwd)/defold/gfx/$f'" >> $LIST_FILE
done
ffmpeg -y -f concat -safe 0 -i $LIST_FILE -vf "tile=10x6" web-react/public/cards/atlas.webp
