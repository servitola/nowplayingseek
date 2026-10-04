#!/bin/sh
# Every entry of COMMANDS, core's and the features', held to what src/README.md asks of a command.
# A new command fails here until it is whole, and each failure says what is missing.
set -u

bin=${1:-build/nowplayingseek-fake}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cases=0
failures=0

fail() {
	failures=$((failures + 1))
	echo "FAIL $1" >&2
}

# A second `run` replaces the tool's own, so osascript prints the table instead of obeying argv:
# a line a command — its name, then its keys.
probe=$work/probe
# shellcheck disable=SC2046
{
	echo '#!/usr/bin/osascript -l JavaScript'
	cat $(make print-SOURCES)
	cat <<'JS'
function run() {
    return Object.entries(COMMANDS)
        .map(([name, command]) => [name, typeof command.run, ...Object.keys(command).filter(key => key !== 'run' && command[key])].join(' '))
        .join('\n');
}
JS
} >"$probe"
chmod +x "$probe"
"$probe" >"$work/table" 2>"$work/probe-error" || fail "the command table could not be read: $(cat "$work/probe-error")"
[ -s "$work/table" ] || fail 'the command table is empty'

"$bin" --help >"$work/help"
# The lines that run the tool: through a helper (expect, told, says, listen) or straight as "$bin".
# shellcheck disable=SC2016
grep -hE '^[^#]*(expect|told|says|listen) |"\$bin" ' test/cli.test.sh test/fake.test.sh >"$work/tested"

known_keys='answers takes checksOwnArguments offline hidden'
has() {
	case " $keys " in *" $1 "*) return 0 ;; esac
	return 1
}

while read -r name run keys; do
	cases=$((cases + 1))
	[ "$run" = function ] || fail "$name has no run(args, name, output) — a command is { run, $(echo "$known_keys" | sed 's/ /, /g') }"
	for key in $keys; do
		case " $known_keys " in
		*" $key "*) ;;
		*) fail "$name: \"$key\" is not a key of a command — the keys are run, $(echo "$known_keys" | sed 's/ /, /g')" ;;
		esac
	done

	on_help=false
	grep -qw -- "$name" "$work/help" && on_help=true
	if has hidden; then
		$on_help && fail "$name is hidden: true and on the help page — drop one"
	else
		$on_help || fail "$name is not on the help page — add a line to src/core/usage.js, or hidden: true to its entry"
	fi

	# The command is the first word after the helper's own quoted arguments, or after "$bin".
	grep -qE -- "(' |\" |^listen )$name( |\$|\))" "$work/tested" ||
		fail "$name is run by no case — add an expect to test/cli.test.sh (arguments) or a told to test/fake.test.sh (what the player is told)"

	if ! has checksOwnArguments; then
		"$bin" "$name" --frobnicate >"$work/stdout" 2>"$work/stderr"
		got_exit=$?
		[ "$got_exit" -eq 64 ] ||
			fail "$name --frobnicate: exit $got_exit, expected 64 — a command refuses what it does not take before it touches the player"
		grep -qF -- "$name takes" "$work/stderr" || fail "$name --frobnicate: the error does not name the command, got: $(cat "$work/stderr")"
		if has answers; then
			grep -qF -- '--json' "$work/stderr" || fail "$name answers, and its error does not offer --json: $(cat "$work/stderr")"
		fi
	fi
done <"$work/table"

if [ "$failures" -gt 0 ]; then
	echo "$failures failures over $cases commands" >&2
	exit 1
fi
echo "$cases commands are whole"
