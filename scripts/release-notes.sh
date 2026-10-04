#!/bin/sh
set -eu

changelog=CHANGELOG.md

if [ $# -ne 1 ]; then
	echo "usage: scripts/release-notes.sh <version>" >&2
	exit 64
fi
cd "$(dirname "$0")/.."

section=$(awk -v start="## $1 " 'index($0, start) == 1 { inside = 1; next } /^## / { inside = 0 } inside' "$changelog")
if [ -z "$section" ]; then
	echo "release-notes: $changelog has no section for $1" >&2
	exit 1
fi
# GitHub renders a newline inside a release body as a line break, so wrapped lines are joined.
printf '%s\n' "$section" | sed -e '/./,$!d' | awk '
	/^(- |#|$)/ { if (line != "") print line; line = ""; if ($0 ~ /^(#|$)/) { print; next } }
	{ sub(/^ +/, ""); line = (line == "" ? $0 : line " " $0) }
	END { if (line != "") print line }'
