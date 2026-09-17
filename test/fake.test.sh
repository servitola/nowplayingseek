#!/bin/sh
# The whole tool against a player that is a file: what it was told is a log, what it answers is up to the case.
set -u
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
bin=$work/nowplayingseek
cases=0
failures=0

# SOURCES is built from CORE and FEATURES now, so its expansion comes from make itself (a
# print-% target), not from re-parsing the Makefile text.
sources=$(make print-SOURCES | sed 's|src/system/mediaremote.js|test/fake-mediaremote.js|; s|src/system/artwork.js|test/fake-artwork.js|')
# shellcheck disable=SC2086
{
	echo '#!/usr/bin/osascript -l JavaScript'
	cat $sources
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

# the same, with artwork metadata set and bytes for test/fake-artwork.js to hand back
player_with_artwork() {
	rm -rf "$work/fake" && mkdir -p "$work/fake/xdg/nowplayingseek"
	printf '[timing]\nverify_timeout = 0.3\ncommand_delivery = 0.01\n' >"$work/fake/xdg/nowplayingseek/config.ini"
	printf '{"obeys":true,"now":{"title":"T","artist":"A","album":null,"app":"fake.player","duration":600,"position":120,"playing":true,"rate":1,"timestamp":1,"artworkIdentifier":"abc123","artworkMimeType":"image/jpeg"}}' >"$work/fake/state.json"
	printf 'fake-cover-bytes' >"$work/fake/artwork-source"
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
player true && printf '[knob]\nstep = 5\n' >>"$work/fake/xdg/nowplayingseek/config.ini" && told 'a knob click is [knob] step from the config' 0 'setElapsedTime 125;' forward --knob
# fast so low that any spin is flat out: the second click is max_multiplier times the step
knob_config() { printf '[knob]\nfast = 0.001\n%s\n' "$1" >>"$work/fake/xdg/nowplayingseek/config.ini"; }
second_click() { NPS_FAKE=$work/fake XDG_CONFIG_HOME=$work/fake/xdg "$bin" forward --knob >/dev/null 2>&1 && told "$@" forward --knob; }
player true && knob_config '' && second_click 'a quick second click follows [knob] fast' 0 'setElapsedTime 122;setElapsedTime 130;'
player true && knob_config 'max_multiplier = 1' && second_click 'and [knob] max_multiplier' 0 'setElapsedTime 122;setElapsedTime 124;'
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

# said <name> <expected lines joined by ;> — what `watch` and `stream` said, piped, while the player was told things
said() {
	cases=$((cases + 1))
	got=$(tr '\n' ';' <"$work/said")
	[ "$got" = "$2" ] || fail "$1: said \"$got\", expected \"$2\""
	case $got in *"$(printf '\033')"*) fail "$1: paint in a pipe" ;; esac
}

listen() {
	player true
	printf '[watch]\ninterval = 0.1\n' >>"$work/fake/xdg/nowplayingseek/config.ini"
	NPS_FAKE=$work/fake XDG_CONFIG_HOME=$work/fake/xdg "$bin" "$@" >"$work/said" 2>&1 &
	listener=$!
	sleep 1
	for words in play 'seek 5:00' pause; do
		# shellcheck disable=SC2086
		NPS_FAKE=$work/fake XDG_CONFIG_HOME=$work/fake/xdg "$bin" $words >/dev/null 2>&1
		sleep 0.6
	done
	rm "$work/fake/state.json"
	sleep 0.6
	kill "$listener" 2>/dev/null
	wait "$listener" 2>/dev/null
}

listen watch
said 'watch, piped: the line, then each event and the line after it' '⏸ 02:00 / 10:00  T — A  (fake.player);▶ played;▶ 02:00 / 10:00  T — A  (fake.player);⇥ seeked to 05:00;▶ 05:00 / 10:00  T — A  (fake.player);⏸ paused;⏸ 05:00 / 10:00  T — A  (fake.player);× nothing is playing;'

listen stream --no-artwork
sed 's/"timestamp":"2[^"]*"/"timestamp":"now"/' "$work/said" >"$work/said.still" && mv "$work/said.still" "$work/said"
said 'stream, piped: the item whole, then only what changed, then nothing' '{"type":"data","diff":false,"payload":{}};{"type":"data","diff":false,"payload":{"processIdentifier":1,"bundleIdentifier":"fake.player","playing":false,"title":"T","artist":"A","duration":600,"elapsedTime":120,"timestamp":"1970-01-01T00:00:01Z","playbackRate":0}};{"type":"data","diff":true,"payload":{"playing":true,"playbackRate":1}};{"type":"data","diff":true,"payload":{"elapsedTime":300,"timestamp":"now"}};{"type":"data","diff":true,"payload":{"playing":false,"playbackRate":0}};{"type":"data","diff":false,"payload":{}};'
# left <lines it says at once> <arguments...>: the reader takes those and goes; nothing else will ever be written
left() {
	said_at_once=$1
	shift
	player true
	cases=$((cases + 1))
	NPS_FAKE=$work/fake XDG_CONFIG_HOME=$work/fake/xdg "$bin" "$@" | head -"$said_at_once" >/dev/null &
	sleep 2.5
	pgrep -f "$bin" >/dev/null && {
		fail "$1: still there after its reader left, with nothing changing in the player"
		pkill -f "$bin"
	}
}

left 1 watch
left 2 stream --no-artwork

# says <name> <python expression over `out` (stdout) and `value` (it parsed as JSON, or None)> <arguments...>
says() {
	name=$1 check=$2
	shift 2
	cases=$((cases + 1))
	NPS_FAKE=$work/fake XDG_CONFIG_HOME=$work/fake/xdg "$bin" "$@" >"$work/stdout" 2>"$work/stderr" || fail "$name: exit $? — $(cat "$work/stderr")"
	python3 - "$work/stdout" "$check" <<'PY' || fail "$name: \"$check\" does not hold for: $(head -c 300 "$work/stdout")"
import json, sys
out = open(sys.argv[1], encoding="utf-8").read()
try:
    value = json.loads(out)
except ValueError:
    value = None
lines = out.rstrip("\n").count("\n") + 1
sys.exit(not eval(sys.argv[2]))
PY
}

# One contract for every command that reads or moves the player: a line for people, --json indented,
# --minify on one line, --raw the keys macOS holds. In a pipe nothing is painted.
for words in status 'forward 5' 'backward 5' 'seek 3:00' pause next; do
	# shellcheck disable=SC2086
	{
		player true true && says "$words: a line for people" 'value is None and lines == 1 and "T — A" in out' $words
		player true true && says "$words --json: indented, with the human block" 'value["human"]["app"] and lines > 5' $words --json
		player true true && says "$words --minify: one line" 'value["title"] == "T" and lines == 1' $words --minify
		player true true && says "$words --json --minify, in either order" 'value["title"] == "T" and lines == 1' $words --minify --json
		player true true && says "$words --compact is --minify" 'value["title"] == "T" and lines == 1' $words --compact
		player true true && says "$words --raw: the keys of macOS" '"ElapsedTime" in value and lines > 5' $words --raw
		player true true && says "$words --raw --json is --raw, whatever the order" '"ElapsedTime" in value' $words --json --raw
		player true true && says "$words --raw --minify: one line" '"ElapsedTime" in value and lines == 1' $words --raw --minify
	}
done
player true true && says 'pause --json shows it paused' 'value["playing"] is False' pause --json
player true && says 'play --json shows it playing' 'value["playing"] is True' play --json
player true && says 'seek --json shows where it landed' 'value["position"] == 180 and value["human"]["position"] == "03:00"' seek 3:00 --json
player true && says 'position --json' 'value == {"position": 120, "human": {"position": "02:00"}}' position --json
player true && says 'duration --minify' 'value["duration"] == 600 and lines == 1' duration --minify
player true && says 'position, no flag, is the number scripts read' 'out == "120.000\n"' position
player true && says 'doctor --json' 'value["ok"] is True and value["app"] == "fake.player"' doctor --json
player true && says 'config --json: the settings in force' 'value["settings"]["hold"]["max_time"] == 60 and value["found"] is True' config --json
player true && told 'artwork: no artwork for this item' 2 '' artwork
player_with_artwork && told 'artwork writes the fake bytes and names the path' 0 'artwork abc123;' artwork "$work/cover.jpg"
cases=$((cases + 1))
[ "$(cat "$work/stdout")" = "$work/cover.jpg" ] || fail "artwork prints $(cat "$work/stdout")"
cases=$((cases + 1))
[ "$(cat "$work/cover.jpg" 2>/dev/null)" = fake-cover-bytes ] || fail 'artwork did not write the fake bytes to the path it was given'
player_with_artwork && says 'artwork --json names the path and the mime type' 'value["path"] and value["mimeType"] == "image/jpeg"' artwork --json
player_with_artwork && says 'media-control get carries the cover as base64' 'value["artworkMimeType"] == "image/jpeg" and value["artworkData"] == "ZmFrZS1jb3Zlci1ieXRlcw=="' media-control get
player_with_artwork && says 'media-control get --no-artwork drops it' '"artworkData" not in value and "artworkMimeType" not in value' media-control get --no-artwork
player_with_artwork && says '-h truncates artworkData, as its own help promises' 'value["artworkData"] == "<image/jpeg 16 bytes...>"' media-control get -h

# `stream` polls every 0.2 s; the cover must be fetched once per item, not once per poll.
player_with_artwork
printf '[watch]\ninterval = 0.1\n' >>"$work/fake/xdg/nowplayingseek/config.ini"
NPS_FAKE=$work/fake XDG_CONFIG_HOME=$work/fake/xdg "$bin" stream --no-diff >"$work/said" 2>&1 &
listener=$!
sleep 1.2
kill "$listener" 2>/dev/null
wait "$listener" 2>/dev/null
cases=$((cases + 1))
[ "$(grep -c '^artwork abc123$' "$work/fake/calls.log" 2>/dev/null)" -eq 1 ] || fail "stream fetched artwork $(grep -c '^artwork abc123$' "$work/fake/calls.log" 2>/dev/null) times over ~5 polls of the same item, expected 1"

player true && told 'watch takes no --json' 64 '' watch --json
player true && told 'release takes no --json' 64 '' release --json
cases=$((cases + 1))
grep -qF 'status takes only --json, --raw, --minify' "$work/stderr" && fail 'the wrong command was named'

# The picture in the README is drawn outside this repo; it has shown yesterday's output twice.
player true && told 'status --json for the picture' 0 '' status --json
cases=$((cases + 1))
python3 - "$work/stdout" docs/images/demo.svg <<'PY' || fail 'docs/images/demo.svg does not show the JSON that status --json writes today: run the demo script (AGENTS.md)'
import html, json, re, sys
keys = lambda value: {key: keys(inner) for key, inner in value.items()} if isinstance(value, dict) else None
lines = [line for line in html.unescape(re.sub(r"<[^>]+>", "\n", open(sys.argv[2], encoding="utf-8").read())).split("\n") if line.strip()]
shown = json.loads("".join(lines[next(index for index, line in enumerate(lines) if line.strip() == "{"):]))
sys.exit(keys(shown) != keys(json.load(open(sys.argv[1], encoding="utf-8"))))
PY

player true && rm "$work/fake/state.json"
told 'nothing is playing' 1 '' status
told 'nothing is playing: transport' 1 '' pause
told 'nothing is playing: doctor' 1 '' doctor
told 'nothing is playing: artwork' 1 '' artwork
told 'as nowplaying-cli: nothing is playing is exit 0' 0 '' nowplaying-cli pause
told 'as media-control: nothing is playing is exit 0' 0 '' media-control pause
told 'as mpc: nothing is playing is exit 1' 1 '' mpc next

if [ "$failures" -gt 0 ]; then
	echo "$failures of $cases fake-player cases failed" >&2
	exit 1
fi
echo "$cases fake-player cases passed"
