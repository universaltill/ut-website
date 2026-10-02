#!/usr/bin/env bash
# Generates the srcset variants for the home-page screenshots (ut-docs#3493).
# For every full-size screenshot site/images/<name>.webp this writes
# <name>-{480,640,768,1024,1280}.webp next to it (a ladder fine enough that
# no pick is more than ~1.4x its drawn width, ut-docs#3516); site/index.html
# lists them all plus the original in `srcset`, and tests/responsive-images.spec.js checks each file
# really is the width its descriptor claims. Re-run after replacing a
# screenshot and commit the output — the build does not run this (CI has no
# cwebp, and the files are tiny).
#
# Needs cwebp (brew install webp / apt install webp).
set -euo pipefail
cd "$(dirname "$0")/../site/images"
command -v cwebp >/dev/null || { echo "make-image-variants: cwebp not found (brew install webp)" >&2; exit 1; }
for src in *.webp; do
  case "$src" in *-480.webp|*-640.webp|*-768.webp|*-1024.webp|*-1280.webp) continue ;; esac
  base="${src%.webp}"
  src_w=$(webpinfo "$src" | awk '/Width:/ {print $2; exit}')
  for w in 480 640 768 1024 1280; do
    # Never upscale: a rung as wide as the original adds nothing (#3516 review).
    [ "$w" -lt "$src_w" ] || continue
    cwebp -quiet -q 80 -m 6 -resize "$w" 0 "$src" -o "$base-$w.webp"
  done
done
echo "make-image-variants: done"
