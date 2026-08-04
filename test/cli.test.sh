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
expect 'release with an argument' 64 stderr 'release takes no arguments, got "now"' release now
expect 'unknown flag in place of a time' 64 stderr 'backward needs seconds or mm:ss, got "--fast"' backward --fast
expect 'two times' 64 stderr 'got "20" on top' forward 10 20
expect 'config with an unknown argument' 64 stderr 'config takes "init" or nothing, got "--force"' config --force
expect 'config init with an argument on top' 64 stderr 'config takes "init" or nothing, got "init --force"' config init --force
expect 'status with a misspelt flag' 64 stderr 'status takes only --json, got "--jsno"' status --jsno
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
