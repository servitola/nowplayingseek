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
	elif grep -qF "execution error" "$work/stderr"; then
		fail "$name: a stack trace instead of an error: $(cat "$work/stderr")"
	elif [ "$want_exit" -ne 0 ] && [ -s "$work/stdout" ]; then
		fail "$name: a failure printed to stdout: $(cat "$work/stdout")"
	elif grep -q "$(printf '\033')" "$work/stdout" "$work/stderr"; then
		fail "$name: colour codes went into a pipe"
	fi
}

version=$(sed -n "s/^const VERSION = '\(.*\)';$/\1/p" src/cli.js)

# `make install` also gives the tool its short name.
cases=$((cases + 1))
prefix=$(mktemp -d "$work/prefix.XXXXXX")
make -s install PREFIX="$prefix" >/dev/null 2>&1
[ "$("$prefix/bin/nps" --version)" = "$version" ] || fail "nps, the short name: $("$prefix/bin/nps" --version 2>&1 | head -1)"
make -s uninstall PREFIX="$prefix" >/dev/null 2>&1
cases=$((cases + 1))
[ -e "$prefix/bin/nps" ] || [ -L "$prefix/bin/nps" ] && fail 'uninstall leaves nps behind'

fresh_home
expect 'version' 0 stdout "$version" --version
expect 'help' 0 stdout 'Exit codes' --help
expect 'help, short flag' 0 stdout 'Exit codes' -h
expect 'no arguments prints help' 0 stdout 'Exit codes'

expect 'unknown command' 64 stderr 'unknown command "frobnicate"' frobnicate
expect 'unknown command shows usage' 64 stderr 'Exit codes' frobnicate
expect 'unknown flag after a time' 64 stderr 'forward takes one time, --progressive, --hold and --knob, got "--progresive" on top' forward 10 --progresive
expect 'hold with garbage' 64 stderr 'forward needs seconds or mm:ss, got "abc"' forward abc --hold --progressive
expect 'a knob cannot be held' 64 stderr 'forward: --knob is one click of a knob, it goes without --hold and --progressive' forward --knob --hold
expect 'release with a wrong argument' 64 stderr 'release takes only forward, backward, got "now"' release now
expect 'unknown flag in place of a time' 64 stderr 'backward needs seconds or mm:ss, got "--fast"' backward --fast
expect 'a step of zero' 64 stderr 'forward needs a step above zero' forward 0 --hold
expect 'watch with an argument' 64 stderr 'watch takes no arguments, got "closely"' watch closely
expect 'two times' 64 stderr 'got "20" on top' forward 10 20
expect 'config with an unknown argument' 64 stderr 'config takes "init", "set <setting> <value>" or nothing, got "--force"' config --force
expect 'config init with an argument on top' 64 stderr 'config takes "init", "set <setting> <value>" or nothing, got "init --force"' config init --force
expect 'status with a misspelt flag' 64 stderr 'status takes only --json, --raw, --minify, got "--jsno"' status --jsno
expect 'position with an argument' 64 stderr 'position takes only --json, --raw, --minify, got "now"' position now
expect 'transport with an argument' 64 stderr 'pause takes only --json, --raw, --minify, got "10"' pause 10
expect 'doctor with an argument' 64 stderr 'doctor takes only --json, --raw, --minify, got "--verbose"' doctor --verbose

expect 'seek without a time' 64 stderr 'seek needs seconds or mm:ss, got ""' seek
expect 'seek with two times' 64 stderr 'seek takes one time, got "20" on top' seek 10 20
expect 'seek with garbage' 64 stderr 'seek needs seconds or mm:ss, got "abc"' seek abc
expect 'seek with a negative time' 64 stderr 'got "-5"' seek -5
expect 'seek with 75 seconds in mm:ss' 64 stderr 'got "1:75"' seek 1:75
expect 'forward with garbage' 64 stderr 'forward needs seconds or mm:ss, got "abc"' forward abc
expect 'backward with garbage, progressive' 64 stderr 'backward needs seconds or mm:ss, got "abc"' backward abc --progressive

expect 'a knob does not grow either' 64 stderr 'forward: --knob is one click of a knob' forward --knob --progressive
expect 'every unknown argument is named' 64 stderr 'status takes only --json, --raw, --minify, got "--jsno --rwa"' status --jsno --rwa
expect 'an error carries the name of the tool' 64 stderr 'nowplayingseek: unknown command' frobnicate
cases=$((cases + 1))
awk '/^```/ { code = !code; next } code && length($0) > 84 { print FILENAME ":" FNR; wide = 1 } END { exit wide }' README.md docs/*.md ||
	fail 'a line of code in the docs is wider than GitHub shows: the reader has to scroll sideways'
cases=$((cases + 1))
"$bin" --help | awk 'length($0) > 80 { wide = 1 } END { exit wide }' || fail 'a line of the help is wider than 80 columns and will wrap'
expect 'help: the exit codes' 0 stdout '  2                              the player did not listen' --help
expect 'help: seek' 0 stdout '  seek <time>  ' --help
expect 'help: release' 0 stdout '  release forward  ' --help
cases=$((cases + 1))
grep -qF "## $version" CHANGELOG.md || grep -qF '## Unreleased' CHANGELOG.md || fail "the changelog knows neither $version nor Unreleased"
cases=$((cases + 1))
XDG_CONFIG_HOME=$xdg "$bin" get | grep -qE '^(null|\{)' || fail 'a bare get is not the JSON of media-control'

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
XDG_CONFIG_HOME=$xdg "$bin" get --json | head -1 | grep -q '^{' || fail 'get --json with no property is not the empty object of nowplaying-cli'
cases=$((cases + 1))
[ "$(XDG_CONFIG_HOME=$xdg "$bin" get '' 2>&1)" = null ] || fail "an empty property name: $(XDG_CONFIG_HOME=$xdg "$bin" get '' 2>&1 | head -2)"
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
expect 'as media-control: a mode that is a property of every object' 1 stderr "Invalid mode for command 'shuffle': 'constructor'" media-control shuffle constructor
expect 'as media-control: --now belongs to get' 1 stderr "Unrecognized option 'now'" media-control stream --now
expect 'as media-control: --no-diff belongs to stream' 1 stderr "Unrecognized option 'no-diff'" media-control get --no-diff
expect 'as media-control: repeat without a mode' 1 stderr "Missing mode for command 'repeat'" media-control repeat
expect 'as media-control: a negative speed' 1 stderr 'Negative values are not allowed: -1' media-control speed -1
expect 'as media-control: a fractional speed' 1 stderr "'1.5' is not a valid integer" media-control speed 1.5
expect 'as media-control: get with an unknown option' 1 stderr "Unrecognized option 'bogus'" media-control get --bogus
cases=$((cases + 1))
XDG_CONFIG_HOME=$xdg "$bin" media-control get --no-artwork | grep -qE '^(null|\{"|\{\})' || fail 'as media-control: get is neither null nor an object'
cases=$((cases + 1))
XDG_CONFIG_HOME=$xdg "$bin" get --now | grep -qE '^(null|\{)' || fail 'get with no property, its word taken directly, is not the JSON of media-control'

expect 'as nowplaying-cli: seek with two words is help' 0 stdout 'Example Usage: ' nowplaying-cli seek abc def
expect 'as nowplaying-cli: every line of its help' 0 stdout "$(printf '\tnowplaying-cli pause\n\tnowplaying-cli seek 60')" nowplaying-cli
expect 'as media-control: leading zeros are dropped, as it does' 1 stderr 'Unknown command ID: 99' media-control send 0099
expect 'as media-control: 00 is 0' 1 stderr 'Invalid shuffle mode: 0' media-control shuffle 00
expect 'as media-control: 14 is one past the last id' 1 stderr 'Unknown command ID: 14' media-control send 14
expect 'as media-control: speed without a number' 1 stderr "Missing speed for command 'speed'" media-control speed
expect 'as media-control: an option needs its dashes' 1 stderr "Unrecognized option 'now'" media-control get now
cases=$((cases + 1))
XDG_CONFIG_HOME=$xdg "$bin" media-control get --micros >/dev/null 2>&1 || fail 'as media-control: get --micros is refused'

# playerctl, mpc and shpotify, behind their names.
expect 'as playerctl: a player cannot be chosen' 1 stderr 'choosing a player is out of its reach' playerctl -p spotify play
expect 'as playerctl: a player named after the verb' 1 stderr 'choosing a player is out of its reach' playerctl play-pause -p spotify
expect 'as playerctl: a player named the long way' 1 stderr 'choosing a player is out of its reach' playerctl next --player=vlc
expect 'as playerctl: no words' 64 stderr 'playerctl needs a word' playerctl
expect 'as playerctl: a word that is a property of every object' 64 stderr 'does not know' playerctl constructor
expect 'as playerctl: volume' 1 stderr 'volume is out of its reach' playerctl volume 0.5
expect 'as playerctl: the sign goes after the number' 64 stderr 'does not know "position +30" in the dialect of playerctl' playerctl position +30
expect 'as mpc: volume' 1 stderr 'volume is out of its reach' mpc volume +5
expect 'as mpc: an unknown word, whatever is or is not playing' 64 stderr 'does not know "crossfade 5" in the dialect of mpc' mpc crossfade 5
expect 'as playerctl: a loop word it does not have' 64 stderr 'does not know "repeat sometimes" in the dialect of playerctl' playerctl loop sometimes
expect 'as playerctl: open' 1 stderr 'opening a file or a URL is out of its reach' playerctl open https://example.com
expect 'as shpotify: quit' 1 stderr 'quitting the player is out of its reach' spotify quit
expect 'as shpotify: toggle what' 64 stderr 'does not know "toggle volume" in the dialect of spotify' spotify toggle volume
expect 'as shpotify: vol' 1 stderr 'volume is out of its reach' spotify vol up
expect 'as shpotify: a word that is a property of every object' 64 stderr 'does not know "constructor"' spotify constructor
expect 'as shpotify: play by name' 1 stderr 'playing by name is out of its reach' spotify play 'Seven Samurai'
expect 'as shpotify: an unknown word' 64 stderr 'does not know "dance now" in the dialect of spotify' spotify dance now
expect 'as shpotify: share' 1 stderr 'a link to share is out of its reach' spotify share url

fresh_home
expect 'config without a file: says so' 0 stdout "; $xdg/nowplayingseek/config.ini — not found, these are the defaults" config
expect 'config without a file: defaults' 0 stdout 'max_multiplier = 2.5' config
[ -e "$xdg/nowplayingseek" ] && fail 'config without a file created something'

expect 'config init' 0 stdout "wrote $xdg/nowplayingseek/config.ini" config init
expect 'config after init: file is found' 0 stdout "; $xdg/nowplayingseek/config.ini" config
grep -qF 'not found' "$work/stdout" && fail 'config after init still says "not found"'
grep -v '^[;[]' "$xdg/nowplayingseek/config.ini" | grep -q '=' && fail 'config init wrote a value that is in force: a later default would never reach this file'
grep -q '^; max_time = ' "$xdg/nowplayingseek/config.ini" || fail 'config init did not list max_time, commented'

printf '[seek]\nstep = 7\n' >"$xdg/nowplayingseek/config.ini"
expect 'second config init refuses' 78 stderr "$xdg/nowplayingseek/config.ini already exists" config init
expect 'second config init kept the file' 0 stdout 'step = 7' config

fresh_home
ini=$xdg/nowplayingseek/config.ini
expect 'config set without a file writes one' 0 stdout "wrote knob.fast = 24 to $ini" config set knob.fast 24
expect 'config set is in force' 0 stdout 'fast = 24' config
grep -q '^; step = 10' "$ini" || fail 'config set left the other defaults out of the file it started'
expect 'config set again' 0 stdout "wrote knob.fast = 30 to $ini" config set knob.fast 30
[ "$(grep -c '^fast = ' "$ini")" -eq 1 ] || fail 'config set twice wrote the key twice'
cp "$ini" "$work/before"
expect 'config set of an unknown setting' 64 stderr 'config set needs a setting such as knob.fast, got "knob.fats"' config set knob.fats 24
expect 'config set of a bad value' 64 stderr 'config set knob.fast needs clicks a second above zero, got "0"' config set knob.fast 0
expect 'config set without a value' 64 stderr 'config set knob.fast needs clicks a second above zero, got ""' config set knob.fast
expect 'config set with more on top' 64 stderr 'config takes "init", "set <setting> <value>" or nothing, got "set knob.fast 24 25"' config set knob.fast 24 25
cmp -s "$ini" "$work/before" || fail 'a refused config set changed the file'
expect 'config set --json answers with the settings' 0 stdout '"fast": 12' config set knob.fast 12 --json
fresh_home
expect 'a refused config set writes nothing' 64 stderr 'got "0"' config set knob.fast 0
[ -e "$xdg/nowplayingseek" ] && fail 'a refused config set created something'
write_config '[seek]' 'stpe = 5'
expect 'config set over a broken file' 78 stderr 'line 2: unknown setting [seek] stpe' config set knob.fast 24
grep -q 'fast' "$xdg/nowplayingseek/config.ini" && fail 'config set wrote over a file that does not read'
fresh_home
mkdir -p "$xdg/nowplayingseek" "$xdg/dotfiles"
printf '[knob]\nfast = 18\n' >"$xdg/dotfiles/config.ini"
ln -s "$xdg/dotfiles/config.ini" "$xdg/nowplayingseek/config.ini"
expect 'config set through a symlink' 0 stdout 'wrote knob.fast = 24' config set knob.fast 24
[ -L "$xdg/nowplayingseek/config.ini" ] || fail 'config set replaced a symlinked config with a file'
grep -q '^fast = 24' "$xdg/dotfiles/config.ini" || fail 'config set did not reach the file behind the symlink'

fresh_home
mkdir -p "$xdg/nowplayingseek"
printf '\377\376' >"$xdg/nowplayingseek/config.ini"
expect 'a config that is not text' 78 stderr 'not readable as UTF-8 text' config
fresh_home
xdg=$xdg/deeper/still
expect 'config init makes the directories on the way' 0 stdout "wrote $xdg/nowplayingseek/config.ini" config init
fresh_home
chmod 500 "$xdg"
expect 'config init where it cannot write' 78 stderr "cannot write $xdg/nowplayingseek/config.ini" config init
chmod 700 "$xdg"

write_config '[seek]' 'stpe = 5'
expect 'unknown key' 78 stderr "$xdg/nowplayingseek/config.ini: line 2: unknown setting [seek] stpe" config
write_config '[sekk]' 'step = 5'
expect 'unknown section' 78 stderr 'line 2: unknown setting [sekk] step' config
write_config '; comment' '[seek]' 'step = 0'
expect 'bad value' 78 stderr 'line 3: [seek] step = "0" — expected seconds or mm:ss above zero' config
write_config '[progressive]' 'pattern = 5s:x2, 10s:x3, ...'
expect 'the 0.3.0 ladder is gone' 78 stderr 'line 2: unknown setting [progressive] pattern' config
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
expect 'a broken config does not stop help' 0 stdout 'Exit codes' --help

write_config '# mine' '[seek]' 'step = 1:30' '' '[progressive]' 'ramp = 2.5' 'max_multiplier = 4.5'
expect 'override: step' 0 stdout 'step = 1:30' config
expect 'override: ramp' 0 stdout 'ramp = 2.5' config
expect 'override: max_multiplier' 0 stdout 'max_multiplier = 4.5' config
expect 'override: untouched keys keep defaults' 0 stdout 'streak_gap = 1' config
expect 'a valid config lets argument errors through' 64 stderr 'got "abc"' seek abc

cases=$((cases + 1))
notes=$(scripts/release.sh notes 0.2.0) || fail 'release.sh notes 0.2.0 failed'
case $notes in
'### Changed'*'Commands have full names only'*) ;;
*) fail "release.sh notes 0.2.0 printed: $notes" ;;
esac
case $notes in *'## 0.'* | *'First release'*) fail 'release.sh notes 0.2.0 leaked a heading or the next section' ;; esac
scripts/release.sh notes 9.9.9 >/dev/null 2>&1 && fail 'release.sh notes accepted a version the changelog does not have'

if [ "$failures" -gt 0 ]; then
	echo "$failures of $cases cli cases failed" >&2
	exit 1
fi
echo "$cases cli cases passed"
