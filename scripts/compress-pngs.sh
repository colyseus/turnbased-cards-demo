#!/usr/bin/env bash
set -euo pipefail

# Compress all PNG files in web-react/public/ using oxipng.
# Safe to re-run — oxipng skips already-optimized files.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../web-react/public"

if ! command -v npx &>/dev/null; then
  echo "error: npx not found" >&2
  exit 1
fi

mapfile -t PNG_FILES < <(find "$PUBLIC_DIR" -name '*.png' -type f 2>/dev/null)

if [ ${#PNG_FILES[@]} -eq 0 ]; then
  echo "No PNG files found in $PUBLIC_DIR — nothing to compress."
  exit 0
fi

echo "Compressing ${#PNG_FILES[@]} PNG file(s) in $PUBLIC_DIR ..."

BEFORE=$(du -sb "${PNG_FILES[@]}" | awk '{s+=$1} END {print s}')

npx --yes oxipng -o 2 --strip safe "${PNG_FILES[@]}"

AFTER=$(du -sb "${PNG_FILES[@]}" | awk '{s+=$1} END {print s}')

SAVED=$(( BEFORE - AFTER ))
echo "Done. Saved $(( SAVED / 1024 )) KB (${BEFORE} -> ${AFTER} bytes)"
