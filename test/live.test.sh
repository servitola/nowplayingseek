#!/bin/sh
# Drives a real player: VLC on five minutes of generated silence, paused, so nothing is heard.
# Starting VLC takes Now Playing away from whatever had it, so this refuses to run while
# something is playing. `make test-live`.
set -u

bin=$(cd "$(dirname "${1:-build/nowplayingseek}")" && pwd)/$(basename "${1:-build/nowplayingseek}")
vlc=org.videolan.vlc
work=$(mktemp -d)
launched=
cases=0
failures=0

finish() {
	[ -n "$launched" ] && osascript -e 'tell application "VLC" to quit' >/dev/null 2>&1
	rm -rf "$work"
}
trap finish EXIT
trap 'exit 130' INT TERM

fail() {
	failures=$((failures + 1))
	echo "FAIL $1" >&2
}

field() { "$bin" status --json 2>/dev/null | sed -n "s/.*\"$1\":\([^,}]*\).*/\1/p" | tr -d '"'; }

# The owner may press play elsewhere at any moment; never send a command to another app.
guard() {
	[ "$(field app)" = "$vlc" ] || {
		echo "ABORT: Now Playing went to \"$(field app)\", nothing more is sent" >&2
		exit 3
	}
}

at() {
	guard
	"$bin" seek "$1" >/dev/null 2>&1
	sleep 1
}

# expect_move <name> <from> <lowest> <highest>: the position moved by that much since <from>
expect_move() {
	cases=$((cases + 1))
	sleep 0.6
	moved=$(echo "$("$bin" position) - $2" | bc)
	[ "$(echo "$moved >= $3 && $moved <= $4" | bc)" = 1 ] || fail "$1: moved $moved, expected $3…$4"
}

expect_exit() {
	name=$1 want=$2
	shift 2
	cases=$((cases + 1))
	guard
	"$bin" "$@" >"$work/out" 2>&1
	got=$?
	[ "$got" -eq "$want" ] || fail "$name: exit $got, expected $want — $(cat "$work/out")"
}

silence() {
	# A WAV header for 300 s of 8 kHz 8-bit mono, then the samples: 128 is silence.
	printf 'RIFF\044\237\044\000WAVEfmt \020\000\000\000\001\000\001\000\100\037\000\000\100\037\000\000\001\000\010\000data\000\237\044\000' >"$1"
	head -c 2400000 /dev/zero | tr '\0' '\200' >>"$1"
}

[ -d /Applications/VLC.app ] || {
	echo "skipped: VLC is not installed" >&2
	exit 0
}
[ "$(field playing)" = true ] && {
	echo "refused: \"$(field title)\" is playing in $(field app) — pause it first" >&2
	exit 3
}

pgrep -x VLC >/dev/null || launched=yes
silence "$work/silence.wav"
open -g -a VLC "$work/silence.wav"
tries=0
until [ "$(field app)" = "$vlc" ]; do
	tries=$((tries + 1))
	[ "$tries" -gt 20 ] && {
		echo "ABORT: VLC did not become Now Playing" >&2
		exit 3
	}
	sleep 0.5
done

expect_exit 'pause' 0 pause
cases=$((cases + 1))
[ "$(field playing)" = false ] || fail 'a paused VLC still reads as playing'
sleep 2
cases=$((cases + 1))
before=$("$bin" position)
sleep 1
[ "$("$bin" position)" = "$before" ] || fail 'the position of a paused VLC keeps running'

at 2:00
expect_move 'seek 2:00' 0 119.5 120.5
expect_exit 'forward' 0 forward
expect_move 'forward' 120 10 10
expect_exit 'backward 5' 0 backward 5
expect_move 'backward 5' 120 5 5

at 2:00
for _ in 1 2 3 4 5; do
	"$bin" forward >/dev/null 2>&1 &
	sleep 0.03
done
wait
expect_move 'five presses 30 ms apart' 120 50 50

at 2:00
"$bin" forward --hold >/dev/null 2>&1 &
sleep 1.2
"$bin" release forward
wait
expect_move 'hold for 1.2 s' 120 60 70

at 2:00
"$bin" forward --hold --progressive >/dev/null 2>&1 &
sleep 0.08
"$bin" release forward
wait
expect_move 'a tap on a hold key is one step' 120 10 10

at 2:00
"$bin" forward --hold >/dev/null 2>&1 &
sleep 0.6
"$bin" backward --hold >/dev/null 2>&1 &
sleep 0.3
"$bin" release forward
sleep 1.2
"$bin" release backward
wait
expect_move 'rolling from one key to the other keeps the second going' 120 -60 -20

at 2:00
"$bin" forward --hold >/dev/null 2>&1 &
sleep 1
"$bin" release
wait
expect_move 'a bare release stops it' 120 50 60

at 1:00
"$bin" forward --hold --progressive >"$work/hold" 2>&1 &
sleep 3
"$bin" release forward
wait
expect_move 'progressive hold for 3 s' 60 80 100
cases=$((cases + 1))
grep -q '×0\.[789]' "$work/hold" || fail "progressive hold: the line does not end with ×0.8, got: $(cat "$work/hold")"

at 2:00
for _ in 1 2 3; do
	"$bin" forward --progressive >/dev/null 2>&1
	sleep 0.4
done
expect_move 'separate progressive presses are whole steps' 120 30 30

mkdir -p "$work/xdg/nowplayingseek"
printf '[hold]\nmax_time = 1\n' >"$work/xdg/nowplayingseek/config.ini"
at 2:00
XDG_CONFIG_HOME=$work/xdg "$bin" forward 1 --hold >/dev/null 2>&1
expect_move 'the fuse ends a hold nobody released' 120 4 6

at 2:00
for _ in 1 2 3 4 5; do
	"$bin" forward --knob >/dev/null 2>&1 &
	sleep 0.5
done
wait
expect_move 'knob, slow clicks' 120 15 18

at 1:00
for _ in 1 2 3 4 5 6 7 8 9 10; do
	"$bin" forward --knob >/dev/null 2>&1 &
	sleep 0.05
done
wait
expect_move 'knob, a flick' 60 60 160

at 4:50
expect_exit 'forward near the end' 0 forward 30
expect_move 'a step forward stops short of the end, the item lives' 290 4.5 5.5
expect_exit 'forward at the margin does nothing' 0 forward
expect_move 'forward at the margin' 295 -0.5 0.5

at 2:00
expect_exit 'seek to where it already is' 0 seek 2:00
expect_exit 'seek 0' 0 seek 0
expect_move 'seek 0' 0 0 0.5
expect_exit 'backward at the start' 0 backward
expect_exit 'status --raw' 0 status --raw
cases=$((cases + 1))
grep -q '"Duration": 300' "$work/out" || fail "status --raw lacks the duration: $(cat "$work/out")"

# The dialect of nowplaying-cli, against the real one when it is installed. Only reads.
at 2:00
cases=$((cases + 1))
[ "$("$bin" get elapsedTime)" = "$("$bin" position | sed 's/0*$//; s/\.$//')" ] || fail "get elapsedTime is $("$bin" get elapsedTime), position is $("$bin" position)"
cases=$((cases + 1))
[ "$("$bin" nowplaying-cli get playbackRate)" = 0 ] || fail 'a paused VLC has a playbackRate other than 0'
if command -v nowplaying-cli >/dev/null; then
	set -- title artist album duration clientBundleIdentifier genre nosuchprop Title
	cases=$((cases + 1))
	[ "$(nowplaying-cli get "$@")" = "$("$bin" get "$@")" ] || fail "get differs from nowplaying-cli: $(nowplaying-cli get "$@" | tr '\n' '|') vs $("$bin" get "$@" | tr '\n' '|')"
	cases=$((cases + 1))
	[ "$(nowplaying-cli get --json "$@" | sort)" = "$("$bin" nowplaying-cli get --json "$@" | sort)" ] || fail 'get --json differs from nowplaying-cli'
	cases=$((cases + 1))
	[ "$(nowplaying-cli bogus)" = "$("$bin" nowplaying-cli bogus)" ] || fail 'the help text differs from nowplaying-cli'
fi

if [ "$failures" -gt 0 ]; then
	echo "$failures of $cases live cases failed" >&2
	exit 1
fi
echo "$cases live cases passed"
