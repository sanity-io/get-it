#!/usr/bin/env bash
#
# Builds the package, minifies the browser entry point with terser
# (simulating realistic bundler settings), and reports raw + gzip sizes.
#
set -euo pipefail

echo "Building..."
npm run build --silent

echo "Minifying dist/index.js → dist/index.min.js..."
npx terser dist/index.js \
  --ecma 2022 \
  --module \
  --compress passes=2,pure_getters=true,unsafe_methods=true \
  --mangle toplevel=true \
  --mangle-props regex='/^_/' \
  --output dist/index.min.js

cp dist/index.min.js dist/index.min.pretty.js
npx prettier --ignore-path /dev/null --write dist/index.min.pretty.js --log-level silent

kb() { echo "scale=2; $1 / 1024" | bc; }

original=$(wc -c < dist/index.js | tr -d ' ')
raw=$(wc -c < dist/index.min.js | tr -d ' ')
gzipped=$(gzip -c dist/index.min.js | wc -c | tr -d ' ')

echo ""
echo "dist/index.js (original):  $(kb $original) kB"
echo "dist/index.min.js:         $(kb $raw) kB"
echo "dist/index.min.js (gzip):  $(kb $gzipped) kB"
