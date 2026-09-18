#!/bin/sh
set -eu

limit=200
status=0

for file in "$@"; do
	lines=$(($(wc -l <"$file")))
	if [ "$lines" -gt "$limit" ]; then
		echo "$file: $lines lines, the limit is $limit"
		status=1
	fi
done

exit "$status"
