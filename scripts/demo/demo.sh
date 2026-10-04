#!/bin/sh
# Redraws docs/images/demo.svg, the README's terminal, with the real painters over sample data.
# Run it whenever the painted output changes: a picture of yesterday's output is a false claim.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cat "$repo/src/logic/time.js" "$repo/src/logic/item.js" "$repo/src/logic/paint.js" "$here/demo.js" >"$tmp/demo.js"
osascript -l JavaScript "$tmp/demo.js" |
	python3 "$here/demo-svg.py" 'nowplayingseek status, backward, seek, pause and status --json in a terminal' >"$repo/docs/images/demo.svg"
echo "wrote $repo/docs/images/demo.svg"
