#!/usr/bin/env bash
#
# Builds the package, minifies the browser entry point with terser
# (simulating realistic bundler settings), and reports raw + gzip sizes.
#
set -euo pipefail

echo "Building..."
npm run build --silent

# tsdown code-splits shared code into hashed chunks, so dist/index.js is often
# a thin re-export. Bundle it back into a single file first so the size we
# report reflects what a real consumer's bundler would actually ship. Reuse
# rolldown (tsdown's bundler) so this needs no extra dependency.
echo "Bundling dist/index.js → dist/index.bundled.js..."
npx rolldown dist/index.js \
  --format esm \
  --platform browser \
  --file dist/index.bundled.js

echo "Minifying dist/index.bundled.js → dist/index.min.js..."
npx terser dist/index.bundled.js \
  --ecma 2022 \
  --module \
  --compress passes=2,pure_getters=true,unsafe_methods=true \
  --mangle toplevel=true \
  --mangle-props regex='/^_/' \
  --output dist/index.min.js

cp dist/index.min.js dist/index.min.pretty.js
npx oxfmt --ignore-path /dev/null dist/index.min.pretty.js

kb() { echo "scale=2; $1 / 1024" | bc; }

original=$(wc -c < dist/index.bundled.js | tr -d ' ')
raw=$(wc -c < dist/index.min.js | tr -d ' ')
gzipped=$(gzip -c dist/index.min.js | wc -c | tr -d ' ')

echo ""
echo "dist/index.bundled.js:     $(kb $original) kB"
echo "dist/index.min.js:         $(kb $raw) kB"
echo "dist/index.min.js (gzip):  $(kb $gzipped) kB"
