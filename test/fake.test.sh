#!/bin/sh
# The whole tool against a player that is a file: what it was told is a log, what it answers is up to the case.
set -u
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
bin=$work/nowplayingseek
cases=0
failures=0

# shellcheck disable=SC2016
sources=$(sed -n 's/^SOURCES := \$(PURE) //p' Makefile | sed 's|src/system/mediaremote.js|test/fake-mediaremote.js|')
pure=$(sed -n 's/^PURE := //p' Makefile)
# shellcheck disable=SC2086
{
	echo '#!/usr/bin/osascript -l JavaScript'
	cat $pure $sources
} |
	sed "s|^const TEMPORARY = .*|const TEMPORARY = \`\${\$.NSProcessInfo.processInfo.environment.objectForKey('NPS_FAKE').js}/\`;|" >"$bin"
chmod +x "$bin"

fail() {
	failures=$((failures + 1))
	echo "FAIL $1" >&2
}

# player <obeys> [playing]: a paused (or playing) item of ten minutes, two minutes in
player() {
	rm -rf "$work/fake" && mkdir -p "$work/fake/xdg/nowplayingseek"
	printf '[timing]\nverify_timeout = 0.3\ncommand_delivery = 0.01\n' >"$work/fake/xdg/nowplayingseek/config.ini"
	printf '{"obeys":%s,"now":{"title":"T","artist":"A","album":null,"app":"fake.player","duration":600,"position":120,"playing":%s,"rate":1,"timestamp":1}}' "$1" "${2:-false}" >"$work/fake/state.json"
}

# told <name> <exit code> <what the player was told, lines joined by ;> <arguments...>
told() {
	name=$1 want_exit=$2 want_calls=$3
	shift 3
	cases=$((cases + 1))
	NPS_FAKE=$work/fake XDG_CONFIG_HOME=$work/fake/xdg "$bin" "$@" >"$work/stdout" 2>"$work/stderr"
	got_exit=$?
	got_calls=$(cat "$work/fake/calls.log" 2>/dev/null | tr '\n' ';')
	[ "$got_exit" -eq "$want_exit" ] || fail "$name: exit $got_exit, expected $want_exit — $(cat "$work/stderr")"
	[ "$got_calls" = "$want_calls" ] || fail "$name: the player was told \"$got_calls\", expected \"$want_calls\""
}

player true && told 'backward goes back' 0 'setElapsedTime 115;' backward 5
player true && told 'forward by the default step' 0 'setElapsedTime 130;' forward
player true && told 'a knob click is the knob step' 0 'setElapsedTime 122;' forward --knob
player true && told 'seek past the end is the end' 0 'setElapsedTime 600;' seek 20:00
player true && told 'seek to where it stands sends nothing' 0 '' seek 2:00
player true && told 'position' 0 '' position
cases=$((cases + 1))
[ "$(cat "$work/stdout")" = 120.000 ] || fail "position prints $(cat "$work/stdout")"
player true && told 'status, piped, is the plain line' 0 '' status
cases=$((cases + 1))
[ "$(cat "$work/stdout")" = '⏸ 02:00 / 10:00  T — A  (fake.player)' ] || fail "status prints $(cat "$work/stdout")"
player true && told 'doctor' 0 '' doctor
player true && told 'a bare release releases both keys' 0 '' release
cases=$((cases + 1))
[ -s "$work/fake/nowplayingseek.release-forward.json" ] && [ -s "$work/fake/nowplayingseek.release-backward.json" ] || fail 'a bare release did not write both'

player true && told 'pause' 0 'send 1;' pause
player true && told 'next' 0 'send 4;' next
player true && told 'previous' 0 'send 5;' previous
player true && told 'togglePlayPause, the word of nowplaying-cli' 0 'send 2;' togglePlayPause
player true && told 'as nowplaying-cli: togglePlayPause' 0 'send 2;' nowplaying-cli togglePlayPause
player true && told 'as playerctl: play-pause' 0 'send 2;' playerctl play-pause
player true && told 'as playerctl: previous' 0 'send 5;' playerctl previous
player true && told 'as mpc: prev' 0 'send 5;' mpc prev
player true && told 'as shpotify: pause is a toggle' 0 'send 2;' spotify pause
player true && told 'as shpotify, by its other name' 0 'send 4;' shpotify next
player true && told 'as media-control: next-track' 0 'send 4;' media-control next-track
player true && told 'as media-control: previous-track, its word taken directly' 0 'send 5;' previous-track
player true && told 'as media-control: send 002' 0 'send 2;' media-control send 002
player true && told 'as media-control: send 0 is play' 0 'send 0;' media-control send 0
player true && told 'as media-control: send 13 is the last id' 0 'send 13;' media-control send 13
player true && told 'as media-control: shuffle tracks' 0 'setMode shuffle 3;' media-control shuffle tracks
player true && told 'as media-control: repeat off' 0 'setMode repeat 1;' media-control repeat off
player true && told 'as media-control: speed 0' 0 'setMode speed 0;' speed 0
player true && told 'as media-control: seek 0' 0 'setElapsedTime 0;' media-control seek 0
player true && told 'as media-control: seek truncates to a microsecond' 0 'setElapsedTime 22.999999;' media-control seek 22.9999999
player true && told 'as nowplaying-cli: seek 1e1' 0 'setElapsedTime 10;' nowplaying-cli seek 1e1
player true && told 'as playerctl: position 45' 0 'setElapsedTime 45;' playerctl position 45
player true && told 'as playerctl: status' 0 '' playerctl status
cases=$((cases + 1))
[ "$(cat "$work/stdout")" = Paused ] || fail "playerctl status prints $(cat "$work/stdout")"
player true && told 'as shpotify: status names the app' 0 '' spotify status
cases=$((cases + 1))
grep -qF 'player is currently paused.' "$work/stdout" || fail "spotify status prints $(cat "$work/stdout")"
player true && told 'as mpc: status rounds the percentage down' 0 '' mpc status
cases=$((cases + 1))
grep -qF '2:00/10:00 (20%)' "$work/stdout" || fail "mpc status prints $(cat "$work/stdout")"

player false && told 'a player that ignores a seek' 2 'setElapsedTime 10;' seek 10
player false && told 'pause, already paused, has nothing to wait for' 0 'send 1;' pause
player false true && told 'a player that ignores pause while playing' 2 'send 1;' pause
player false && told 'as media-control: it exits 0 all the same' 0 'setElapsedTime 10;' media-control seek 10
player false true && told 'as nowplaying-cli: it exits 0 all the same' 0 'send 1;' nowplaying-cli pause
player false true && told 'as playerctl: it does not' 2 'send 1;' playerctl pause

player true && rm "$work/fake/state.json"
told 'nothing is playing' 1 '' status
told 'nothing is playing: transport' 1 '' pause
told 'nothing is playing: doctor' 1 '' doctor
told 'as nowplaying-cli: nothing is playing is exit 0' 0 '' nowplaying-cli pause
told 'as media-control: nothing is playing is exit 0' 0 '' media-control pause
told 'as mpc: nothing is playing is exit 1' 1 '' mpc next

if [ "$failures" -gt 0 ]; then
	echo "$failures of $cases fake-player cases failed" >&2
	exit 1
fi
echo "$cases fake-player cases passed"
