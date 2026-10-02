#!/usr/bin/env bash
# Generates the srcset variants for the home-page screenshots (ut-docs#3493).
# For every full-size screenshot site/images/<name>.webp this writes
# <name>-640.webp and <name>-1024.webp next to it; site/index.html lists all
# three in `srcset`, and tests/responsive-images.spec.js checks each file
# really is the width its descriptor claims. Re-run after replacing a
# screenshot and commit the output — the build does not run this (CI has no
# cwebp, and the files are tiny).
#
# Needs cwebp (brew install webp / apt install webp).
set -euo pipefail
cd "$(dirname "$0")/../site/images"
command -v cwebp >/dev/null || { echo "make-image-variants: cwebp not found (brew install webp)" >&2; exit 1; }
for src in *.webp; do
  case "$src" in *-640.webp|*-1024.webp) continue ;; esac
  base="${src%.webp}"
  for w in 640 1024; do
    cwebp -quiet -q 80 -m 6 -resize "$w" 0 "$src" -o "$base-$w.webp"
  done
done
echo "make-image-variants: done"
