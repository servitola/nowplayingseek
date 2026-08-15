#!/bin/sh
# Everything here runs before the tool touches the player, so it needs nothing playing.
set -u

bin=${1:-build/nowplayingseek}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
trap 'exit 130' INT TERM

xdg=
cases=0
failures=0

fresh_home() {
	xdg=$(mktemp -d "$work/xdg.XXXXXX")
}

write_config() {
	fresh_home
	mkdir -p "$xdg/nowplayingseek"
	printf '%s\n' "$@" >"$xdg/nowplayingseek/config.ini"
}

fail() {
	failures=$((failures + 1))
	echo "FAIL $1" >&2
}

# expect <name> <exit code> <stdout|stderr> <text the stream must contain> <arguments...>
expect() {
	name=$1 want_exit=$2 stream=$3 want_text=$4
	shift 4
	cases=$((cases + 1))
	XDG_CONFIG_HOME=$xdg "$bin" "$@" >"$work/stdout" 2>"$work/stderr"
	got_exit=$?
	if [ "$got_exit" -ne "$want_exit" ]; then
		fail "$name: exit $got_exit, expected $want_exit"
	elif ! grep -qF -- "$want_text" "$work/$stream"; then
		fail "$name: $stream lacks \"$want_text\", got: $(cat "$work/$stream")"
	elif [ "$want_exit" -ne 0 ] && [ -s "$work/stdout" ]; then
		fail "$name: a failure printed to stdout: $(cat "$work/stdout")"
	fi
}

version=$(sed -n "s/^const VERSION = '\(.*\)';$/\1/p" src/cli.js)

fresh_home
expect 'version' 0 stdout "$version" --version
expect 'help' 0 stdout 'exit codes:' --help
expect 'help, short flag' 0 stdout 'exit codes:' -h
expect 'no arguments prints help' 0 stdout 'exit codes:'

expect 'unknown command' 64 stderr 'unknown command "frobnicate"' frobnicate
expect 'unknown command shows usage' 64 stderr 'exit codes:' frobnicate
expect 'unknown flag after a time' 64 stderr 'forward takes one time, --progressive, --hold and --knob, got "--progresive" on top' forward 10 --progresive
expect 'hold with garbage' 64 stderr 'forward needs seconds or mm:ss, got "abc"' forward abc --hold --progressive
expect 'a knob cannot be held' 64 stderr 'forward: --knob is one click of a knob, it goes without --hold and --progressive' forward --knob --hold
expect 'release with a wrong argument' 64 stderr 'release takes only forward, backward, got "now"' release now
expect 'unknown flag in place of a time' 64 stderr 'backward needs seconds or mm:ss, got "--fast"' backward --fast
expect 'a step of zero' 64 stderr 'forward needs a step above zero' forward 0 --hold
expect 'two times' 64 stderr 'got "20" on top' forward 10 20
expect 'config with an unknown argument' 64 stderr 'config takes "init" or nothing, got "--force"' config --force
expect 'config init with an argument on top' 64 stderr 'config takes "init" or nothing, got "init --force"' config init --force
expect 'status with a misspelt flag' 64 stderr 'status takes only --json, --raw, got "--jsno"' status --jsno
expect 'position with an argument' 64 stderr 'position takes no arguments, got "now"' position now
expect 'transport with an argument' 64 stderr 'pause takes no arguments, got "10"' pause 10
expect 'doctor with an argument' 64 stderr 'doctor takes no arguments, got "--verbose"' doctor --verbose

expect 'seek without a time' 64 stderr 'seek needs seconds or mm:ss, got ""' seek
expect 'seek with two times' 64 stderr 'seek takes one time, got "20" on top' seek 10 20
expect 'seek with garbage' 64 stderr 'seek needs seconds or mm:ss, got "abc"' seek abc
expect 'seek with a negative time' 64 stderr 'got "-5"' seek -5
expect 'seek with 75 seconds in mm:ss' 64 stderr 'got "1:75"' seek 1:75
expect 'forward with garbage' 64 stderr 'forward needs seconds or mm:ss, got "abc"' forward abc
expect 'backward with garbage, progressive' 64 stderr 'backward needs seconds or mm:ss, got "abc"' backward abc --progressive

# The dialect of nowplaying-cli: its words, its texts, its exit codes.
expect 'as nowplaying-cli: an unknown word is help and exit 0' 0 stdout 'get, get-raw, play, pause, togglePlayPause, next, previous, seek <secs>' nowplaying-cli bogus
expect 'as nowplaying-cli: no arguments is help' 0 stdout 'nowplaying-cli get --json title album artist' nowplaying-cli
expect 'as nowplaying-cli: seek without a number is help' 0 stdout 'Example Usage: ' nowplaying-cli seek
expect 'as nowplaying-cli: a bad seek time' 1 stderr 'Invalid seek time: abc' nowplaying-cli seek abc
expect 'as nowplaying-cli: a bad seek time names the usage' 1 stderr 'Usage: nowplaying-cli seek <secs>' nowplaying-cli seek 60abc
cases=$((cases + 1))
[ -z "$(XDG_CONFIG_HOME=$xdg "$bin" nowplaying-cli get)" ] || fail 'as nowplaying-cli: get with no property prints something'
cases=$((cases + 1))
[ "$(XDG_CONFIG_HOME=$xdg "$bin" nowplaying-cli get nosuchprop)" = null ] || fail 'as nowplaying-cli: an unknown property is not the word null'
cases=$((cases + 1))
[ "$(XDG_CONFIG_HOME=$xdg "$bin" get nosuchprop)" = null ] || fail 'get, its word taken directly: an unknown property is not the word null'
cases=$((cases + 1))
XDG_CONFIG_HOME=$xdg "$bin" get --json nosuchprop | grep -qF '"nosuchprop" : null' || fail 'get --json is not in Foundation house style'
cases=$((cases + 1))
XDG_CONFIG_HOME=$xdg "$bin" get-raw | head -1 | grep -q '^{' || fail 'get-raw does not print a JSON object'

# The dialect of media-control.
expect 'as media-control: no arguments is its help' 0 stdout '  media-control toggle-play-pause' media-control
expect 'as media-control: the command table' 0 stdout '  go-back-fifteen-seconds   Go back 15 seconds              12' media-control help
expect 'as media-control: version' 0 stdout 'media-control 0.7.7' media-control version
expect 'as media-control: an unknown command' 1 stderr "Unknown command 'bogus'" media-control bogus
expect 'as media-control: send without an id' 1 stderr "Missing ID for command 'send'" media-control send
expect 'as media-control: send with a word' 1 stderr "'abc' is not a valid integer" media-control send abc
expect 'as media-control: send with an unknown id' 1 stderr 'Unknown command ID: 99' media-control send 99
expect 'seek --micros, the word of media-control taken directly' 1 stderr "'abc' is not a valid number" seek abc --micros
expect 'as media-control: seek without a position' 1 stderr "Missing position for command 'seek'" media-control seek
expect 'as media-control: seek with a word' 1 stderr "'abc' is not a valid number" media-control seek abc
expect 'as media-control: a negative seek, in its microseconds' 1 stderr 'Negative values are not allowed: -5000000' media-control seek -5
expect 'as media-control: shuffle with an unknown word' 1 stderr "Invalid mode for command 'shuffle': 'xyz'" media-control shuffle xyz
expect 'as media-control: shuffle with a number out of range' 1 stderr 'Invalid shuffle mode: 9' media-control shuffle 9
expect 'as media-control: repeat without a mode' 1 stderr "Missing mode for command 'repeat'" media-control repeat
expect 'as media-control: a negative speed' 1 stderr 'Negative values are not allowed: -1' media-control speed -1
expect 'as media-control: a fractional speed' 1 stderr "'1.5' is not a valid integer" media-control speed 1.5
expect 'as media-control: get with an unknown option' 1 stderr "Unrecognized option 'bogus'" media-control get --bogus
cases=$((cases + 1))
XDG_CONFIG_HOME=$xdg "$bin" media-control get --no-artwork | grep -qE '^(null|\{"|\{\})' || fail 'as media-control: get is neither null nor an object'
cases=$((cases + 1))
XDG_CONFIG_HOME=$xdg "$bin" get --now | grep -qE '^(null|\{)' || fail 'get with no property, its word taken directly, is not the JSON of media-control'

# playerctl, mpc and shpotify, behind their names.
expect 'as playerctl: a player cannot be chosen' 1 stderr 'choosing a player is out of its reach' playerctl -p spotify play
expect 'as playerctl: volume' 1 stderr 'volume is out of its reach' playerctl volume 0.5
expect 'as playerctl: the sign goes after the number' 64 stderr 'does not know "position +30" in the dialect of playerctl' playerctl position +30
expect 'as mpc: volume' 1 stderr 'volume is out of its reach' mpc volume +5
expect 'as shpotify: play by name' 1 stderr 'playing by name is out of its reach' spotify play 'Seven Samurai'
expect 'as shpotify: an unknown word' 64 stderr 'does not know "share url" in the dialect of spotify' spotify share url

fresh_home
expect 'config without a file: says so' 0 stdout "; $xdg/nowplayingseek/config.ini — not found, these are the defaults" config
expect 'config without a file: defaults' 0 stdout 'max_multiplier = 2.5' config
[ -e "$xdg/nowplayingseek" ] && fail 'config without a file created something'

expect 'config init' 0 stdout "wrote $xdg/nowplayingseek/config.ini" config init
expect 'config after init: file is found' 0 stdout "; $xdg/nowplayingseek/config.ini" config
grep -qF 'not found' "$work/stdout" && fail 'config after init still says "not found"'
XDG_CONFIG_HOME=$xdg "$bin" config | sed 1,2d | cmp -s - "$xdg/nowplayingseek/config.ini" ||
	fail 'config init wrote something other than the defaults config prints'

printf '[seek]\nstep = 7\n' >"$xdg/nowplayingseek/config.ini"
expect 'second config init refuses' 78 stderr "$xdg/nowplayingseek/config.ini already exists" config init
expect 'second config init kept the file' 0 stdout 'step = 7' config

write_config '[seek]' 'stpe = 5'
expect 'unknown key' 78 stderr "$xdg/nowplayingseek/config.ini: line 2: unknown setting [seek] stpe" config
write_config '[sekk]' 'step = 5'
expect 'unknown section' 78 stderr 'line 2: unknown setting [sekk] step' config
write_config '; comment' '[seek]' 'step = 0'
expect 'bad value' 78 stderr 'line 3: [seek] step = "0" — expected seconds or mm:ss above zero' config
write_config '[progressive]' 'pattern = 5s:x2, 10s:x3, ...'
expect 'the 2026.07.31 ladder is gone' 78 stderr 'line 2: unknown setting [progressive] pattern' config
write_config '[progressive]' 'ramp = 0'
expect 'ramp of zero' 78 stderr 'line 2: [progressive] ramp = "0" — expected seconds above zero' config
write_config '[knob]' 'fast = 0'
expect 'knob pace of zero' 78 stderr 'line 2: [knob] fast = "0" — expected clicks a second above zero' config
write_config '[hold]' 'interval = 0'
expect 'hold interval of zero' 78 stderr 'line 2: [hold] interval = "0" — expected seconds above zero' config
write_config '[progressive]' 'max_multiplier = fast'
expect 'garbage number' 78 stderr '[progressive] max_multiplier = "fast" — expected a number above zero' config
write_config 'step = 5'
expect 'key outside a section' 78 stderr 'line 1: expected "[section]" or "key = value" under one, got "step = 5"' config
expect 'a broken config stops other commands too' 78 stderr 'line 1:' forward abc
expect 'a broken config does not stop help' 0 stdout 'exit codes:' --help

write_config '# mine' '[seek]' 'step = 1:30' '' '[progressive]' 'ramp = 2.5' 'max_multiplier = 4.5'
expect 'override: step' 0 stdout 'step = 1:30' config
expect 'override: ramp' 0 stdout 'ramp = 2.5' config
expect 'override: max_multiplier' 0 stdout 'max_multiplier = 4.5' config
expect 'override: untouched keys keep defaults' 0 stdout 'streak_gap = 1' config
expect 'a valid config lets argument errors through' 64 stderr 'got "abc"' seek abc

cases=$((cases + 1))
notes=$(scripts/release.sh notes 2026.07.21) || fail 'release.sh notes 2026.07.21 failed'
case $notes in
'### Changed'*'Commands have full names only'*) ;;
*) fail "release.sh notes 2026.07.21 printed: $notes" ;;
esac
case $notes in *'## 0.'* | *'First release'*) fail 'release.sh notes 2026.07.21 leaked a heading or the next section' ;; esac
scripts/release.sh notes 9.9.9 >/dev/null 2>&1 && fail 'release.sh notes accepted a version the changelog does not have'

if [ "$failures" -gt 0 ]; then
	echo "$failures of $cases cli cases failed" >&2
	exit 1
fi
echo "$cases cli cases passed"
