#!/bin/sh
# The tool is bound to a hotkey, so its own startup time is the product. Runs only against
# build/nowplayingseek-fake — a player that is a file — so timings are deterministic and no run
# ever reaches perl, a real player, or a real hotkey daemon. `make test-speed`, not `make test`:
# wall-clock budgets are noise on a shared, loaded CI runner, signal only on a quiet machine.
set -u

bin=${1:-build/nowplayingseek-fake}
runs=21
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
trap 'exit 130' INT TERM

fake=$work/fake
xdg=$work/xdg
mkdir -p "$fake" "$xdg/nowplayingseek"
printf '{"obeys":true,"now":{"title":"T","artist":"A","album":null,"app":"fake.player","duration":600,"position":120,"playing":true,"rate":1,"timestamp":1,"artworkIdentifier":"abc123","artworkMimeType":"image/jpeg"}}' >"$fake/state.json"
printf 'fake-cover-bytes' >"$fake/artwork-source"
export NPS_FAKE="$fake" XDG_CONFIG_HOME="$xdg"

cases=0
failures=0

# One perl process brackets one run of the tool: Time::HiRes gives millisecond resolution, which
# the owner's own manual `/usr/bin/time -p` check (0.01 s buckets) cannot.
run_ms() {
	perl -MTime::HiRes=time -e '
        my $t0 = time;
        system("$ARGV[0] >/dev/null 2>&1");
        my $t1 = time;
        printf "%.1f\n", ($t1 - $t0) * 1000;
    ' -- "$1"
}

# measure <name> <budget ms> <shell command>: N runs, min/median/max in ms, fails on the median.
# Budgets are ~3.5x a baseline measured on the owner's M1 Max (docs/development.md#response-time).
measure() {
	name=$1 budget=$2 cmd=$3
	cases=$((cases + 1))
	: >"$work/times"
	i=0
	while [ "$i" -lt "$runs" ]; do
		run_ms "$cmd" >>"$work/times"
		i=$((i + 1))
	done
	sort -n "$work/times" >"$work/sorted"
	min=$(sed -n '1p' "$work/sorted")
	max=$(sed -n "${runs}p" "$work/sorted")
	median=$(sed -n "$(((runs + 1) / 2))p" "$work/sorted")
	result=ok
	if awk -v m="$median" -v b="$budget" 'BEGIN { exit !(m > b) }'; then
		result=OVER
		failures=$((failures + 1))
		echo "FAIL $name: median ${median}ms over its ${budget}ms budget (min ${min}ms, max ${max}ms)" >&2
	fi
	printf '%-22s %9s %9s %9s %9s  %s\n' "$name" "${min}ms" "${median}ms" "${max}ms" "${budget}ms" "$result"
}

printf '%-22s %9s %9s %9s %9s  %s\n' case min median max budget result
measure '--help' 200 "$bin --help"
measure 'status --json' 260 "$bin status --json"
measure 'status' 200 "$bin status"
measure 'get' 200 "$bin get"
measure 'get --no-artwork' 180 "$bin get --no-artwork"
measure 'artwork <path>' 180 "$bin artwork $work/artwork-out.jpg"
measure 'forward 5' 320 "$bin forward 5"

# The cache is claimed to fetch artwork once per item, not once per read (src/system/artwork.js):
# `stream`'s loop calls payload() — and so artwork.base64 — on its own poll interval (0.2 s),
# whether or not the item changed, so five silent polls with one fetch in calls.log proves the
# cache held.
cases=$((cases + 1))
: >"$fake/calls.log"
"$bin" stream >"$work/stream-out" 2>"$work/stream-err" &
pid=$!
sleep 1.0
kill "$pid" 2>/dev/null
wait "$pid" 2>/dev/null
fetches=$(grep -c '^artwork ' "$fake/calls.log" 2>/dev/null)
fetches=${fetches:-0}
if [ "$fetches" -eq 1 ]; then
	printf '%-22s %31s  %s\n' 'artwork cache' '1 fetch over ~5 polls' ok
else
	failures=$((failures + 1))
	echo "FAIL artwork cache: $fetches helper fetches over ~5 polls of an unchanged item, expected 1" >&2
fi

if [ "$failures" -gt 0 ]; then
	echo "$failures of $cases speed cases failed" >&2
	exit 1
fi
echo "$cases speed cases passed"
