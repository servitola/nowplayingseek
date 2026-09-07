#!/bin/sh
# What this project believes about software it does not own. Each case is a belief the code or the
# docs rest on; when one stops holding, a workaround may be dead weight or a claim may be a lie.
# It opens VLC and QuickTime Player on generated silence and refuses while something is playing.
# `make test-world`.
set -u

bin=$(cd "$(dirname "${1:-build/nowplayingseek}")" && pwd)/$(basename "${1:-build/nowplayingseek}")
work=$(mktemp -d)
beliefs=0
changed=0
opened=

finish() {
	for app in $opened; do
		osascript -e "tell application \"$app\" to quit" >/dev/null 2>&1
	done
	rm -rf "$work"
}
trap finish EXIT
trap 'exit 130' INT TERM

field() { "$bin" status --minify 2>/dev/null | sed -n "s/,\"human\":.*//;s/.*\"$1\":\([^,}]*\).*/\1/p" | tr -d '"'; }
raw() { "$bin" status --raw 2>/dev/null | sed -n "s/^ *\"$1\": *\([^,]*\),*$/\1/p" | tr -d '"'; }

holds() {
	beliefs=$((beliefs + 1))
	echo "  holds    $1"
}

world_changed() {
	beliefs=$((beliefs + 1))
	changed=$((changed + 1))
	echo "  CHANGED  $1" >&2
	echo "           then: $2" >&2
}

guard() {
	[ "$(field app)" = "$1" ] || {
		echo "ABORT: Now Playing went to \"$(field app)\", nothing more is sent" >&2
		exit 3
	}
}

silence() {
	printf 'RIFF\044\237\044\000WAVEfmt \020\000\000\000\001\000\001\000\100\037\000\000\100\037\000\000\001\000\010\000data\000\237\044\000' >"$1"
	head -c 2400000 /dev/zero | tr '\0' '\200' >>"$1"
}

elect() {
	app=$1 bundle=$2
	pgrep -x "$app" >/dev/null || opened="$opened $app"
	if [ "$app" = VLC ]; then
		open -g -a VLC "$work/silence.wav"
	else
		osascript -e "tell application \"$app\"" -e "play (open POSIX file \"$work/silence.wav\")" -e 'end tell' >/dev/null 2>&1
	fi
	tries=0
	until [ "$(field app)" = "$bundle" ]; do
		tries=$((tries + 1))
		[ "$tries" -gt 20 ] && return 1
		sleep 0.5
	done
	guard "$bundle"
	"$bin" pause >/dev/null 2>&1
	sleep 1
}

[ "$(field playing)" = true ] && {
	echo "refused: \"$(field title)\" is playing in $(field app) — pause it first" >&2
	exit 3
}
silence "$work/silence.wav"

echo 'macOS'
if command -v clang >/dev/null && command -v codesign >/dev/null; then
	cat >"$work/probe.m" <<'EOF'
#import <Foundation/Foundation.h>
int main(void) {
    [[NSBundle bundleWithPath:@"/System/Library/PrivateFrameworks/MediaRemote.framework"] load];
    id item = [NSClassFromString(@"MRNowPlayingRequest") performSelector:NSSelectorFromString(@"localNowPlayingItem")];
    puts(item ? "item" : "nothing");
    return 0;
}
EOF
	if clang -fobjc-arc -framework Foundation "$work/probe.m" -o "$work/probe" 2>/dev/null; then
		elect VLC org.videolan.vlc || echo '  skipped: VLC did not become Now Playing' >&2
		codesign -f -s - -i org.example.probe "$work/probe" >/dev/null 2>&1
		stranger=$("$work/probe")
		codesign -f -s - -i com.apple.probe "$work/probe" >/dev/null 2>&1
		poser=$("$work/probe")
		if [ "$stranger" = nothing ]; then
			holds 'a binary of our own reads nothing of Now Playing — why this tool is a script for osascript'
		else
			world_changed 'a binary of our own reads nothing of Now Playing' 'the gate is open again: a compiled tool would do, docs/how-it-works.md is out of date'
		fi
		if [ "$poser" = item ]; then
			holds 'the same binary signed com.apple.* reads it — the gate is the signing identifier'
		else
			world_changed 'a binary signed com.apple.* reads Now Playing' 'Apple checks more than the identifier now; say so in docs/how-it-works.md'
		fi
	fi
else
	echo '  skipped: no clang, the gate cannot be probed' >&2
fi

echo 'VLC'
if [ -d /Applications/VLC.app ] && elect VLC org.videolan.vlc; then
	if [ "$(raw PlaybackRate)" = 1 ] && [ "$(field playing)" = false ]; then
		holds 'paused, it still reports PlaybackRate 1 — why playing comes from localIsPlaying'
	else
		world_changed 'VLC reports PlaybackRate 1 while paused' "it reports $(raw PlaybackRate): effectiveRate in src/logic/seek.js may no longer be needed for it"
	fi
	guard org.videolan.vlc
	"$bin" seek 22.4 >/dev/null 2>&1
	sleep 1
	if [ "$("$bin" position)" = 22.000 ]; then
		holds 'a seek to 22.4 lands on 22: it keeps whole seconds'
	else
		world_changed 'VLC keeps whole seconds' "seek 22.4 landed on $("$bin" position): test/live.test.sh allows for the old way"
	fi
	if command -v nowplaying-cli >/dev/null; then
		theirs=$(nowplaying-cli get elapsedTime)
		if [ "$theirs" = 0 ] && [ "$("$bin" get elapsedTime)" = 22 ]; then
			holds "nowplaying-cli get elapsedTime is 0 where the position is 22 — the one thing docs/migrating.md says we do differently"
		else
			world_changed 'nowplaying-cli get elapsedTime is always 0' "it says $theirs: docs/migrating.md should stop calling that a difference"
		fi
	fi
else
	echo '  skipped: VLC is not installed or did not become Now Playing' >&2
fi

echo 'QuickTime Player'
if elect 'QuickTime Player' com.apple.QuickTimePlayerX; then
	if [ "$(raw PlaybackRate)" = 0 ]; then
		holds 'paused, it reports PlaybackRate 0, as IINA and browsers do'
	else
		world_changed 'QuickTime reports PlaybackRate 0 while paused' "it reports $(raw PlaybackRate)"
	fi
	guard com.apple.QuickTimePlayerX
	"$bin" seek 22.4 >/dev/null 2>&1
	sleep 1
	if [ "$("$bin" position)" = 22.400 ]; then
		holds 'a seek to 22.4 lands on 22.4: fractions are for the player to keep or drop'
	else
		world_changed 'QuickTime keeps fractions of a second' "seek 22.4 landed on $("$bin" position)"
	fi
	osascript -e 'tell application "QuickTime Player" to close every document saving no' >/dev/null 2>&1
else
	echo '  skipped: QuickTime Player did not become Now Playing' >&2
fi

echo 'Homebrew'
if command -v brew >/dev/null && brew trust --help >/dev/null 2>&1; then
	mkdir "$work/trust"
	if XDG_CONFIG_HOME=$work/trust HOMEBREW_NO_AUTO_UPDATE=1 brew install --dry-run servitola/tap/nowplayingseek 2>&1 | grep -q 'Trusted formula servitola/tap/nowplayingseek'; then
		holds 'naming the formula in full trusts that one formula — the install line in the README is enough'
	else
		world_changed 'brew install with the full name trusts the formula by itself' 'the README must tell people to run brew trust first'
	fi
else
	echo '  skipped: no Homebrew with tap trust here' >&2
fi

if [ "$changed" -gt 0 ]; then
	echo "$changed of $beliefs beliefs about the world no longer hold" >&2
	exit 1
fi
echo "$beliefs beliefs about the world hold"
