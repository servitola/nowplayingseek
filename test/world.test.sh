#!/bin/sh
# What this project believes about software it does not own. Each case is a belief the code or the
# docs rest on; when one stops holding, a workaround may be dead weight or a claim may be a lie.
# Every belief has a name, printed with its verdict. The cases that need a player open VLC and
# QuickTime Player on generated silence and are skipped while something is playing; the rest run
# regardless.
# `make test-world`.
set -u

bin=$(cd "$(dirname "${1:-build/nowplayingseek}")" && pwd)/$(basename "${1:-build/nowplayingseek}")
here=$(cd "$(dirname "$0")" && pwd)
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
answer() { curl -sL -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null; }

holds() {
	beliefs=$((beliefs + 1))
	echo "  holds    $1: $2"
}

world_changed() {
	beliefs=$((beliefs + 1))
	changed=$((changed + 1))
	echo "  CHANGED  $1: $2" >&2
	echo "           then: $3" >&2
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

busy=
[ "$(field playing)" = true ] && busy="\"$(field title)\" is playing in $(field app)"
player_is_free() {
	[ -z "$busy" ] && return 0
	echo "  skipped: $busy — pause it and run again" >&2
	return 1
}
silence "$work/silence.wav"

echo 'macOS, the gate'
if ! player_is_free; then
	:
elif command -v clang >/dev/null && command -v codesign >/dev/null; then
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
			holds gate-own-binary 'a binary of our own reads nothing of Now Playing — why this tool is a script for osascript'
		else
			world_changed gate-own-binary 'a binary of our own reads nothing of Now Playing' 'the gate is open again: a compiled tool would do, docs/how-it-works.md is out of date'
		fi
		if [ "$poser" = item ]; then
			holds gate-apple-identifier 'the same binary signed com.apple.* reads it — the gate is the signing identifier'
		else
			world_changed gate-apple-identifier 'a binary signed com.apple.* reads Now Playing' 'Apple checks more than the identifier now; say so in docs/how-it-works.md'
		fi
	fi
else
	echo '  skipped: no clang, the gate cannot be probed' >&2
fi

echo 'macOS, what it ships'
signers=$(for tool in osascript perl; do codesign -dv /usr/bin/$tool 2>&1 | sed -n 's/^Identifier=//p'; done | tr '\n' ' ')
if [ "$signers" = 'com.apple.osascript com.apple.perl ' ]; then
	holds interpreters-signed-apple 'osascript and perl are signed com.apple.* — the two processes the gate lets read'
else
	world_changed interpreters-signed-apple 'osascript and perl are signed com.apple.*' "they are signed: $signers— docs/how-it-works.md names both identifiers"
fi
if [ "$(uname -m)" = arm64 ] && command -v clang >/dev/null; then
	echo 'int nps_probe(void) { return 0; }' >"$work/plain.c"
	clang -dynamiclib -arch arm64 -o "$work/plain.dylib" "$work/plain.c" 2>/dev/null
	refusal=$(osascript -l JavaScript -e 'function run(argv) {
		ObjC.bindFunction("dlopen", ["void *", ["char *", "int"]]);
		ObjC.bindFunction("dlerror", ["char *", []]);
		$.dlopen(argv[0], 2);
		return String($.dlerror());
	}' "$work/plain.dylib" 2>&1)
	case $refusal in
	*"need 'arm64e'"*) holds osascript-wants-arm64e 'osascript refuses a plain arm64 image: it wants arm64e — why artwork cannot be a helper inside it' ;;
	*) world_changed osascript-wants-arm64e 'osascript refuses a plain arm64 image' "dlopen said: $refusal — a helper inside osascript may do, see Dead ends in docs/how-it-works.md" ;;
	esac
	if /usr/bin/perl -MDynaLoader -e 'exit(DynaLoader::dl_load_file($ARGV[0], 0) ? 0 : 1)' "$work/plain.dylib" 2>/dev/null; then
		holds perl-maps-arm64 'perl loads the same plain arm64 image — why artwork goes through perl'
	else
		world_changed perl-maps-arm64 'perl loads a plain arm64 image' 'artwork has lost its way in: src/core/system/artwork.js and docs/how-it-works.md'
	fi
else
	echo '  skipped: not Apple silicon or no clang, image loading cannot be probed' >&2
fi
if [ -d /System/Applications/Shortcuts.app ]; then
	holds shortcuts-on-every-mac 'Shortcuts is part of the system — the README and docs/shortcuts.md call it already installed'
else
	world_changed shortcuts-on-every-mac 'Shortcuts is part of the system' 'the README and docs/shortcuts.md say it is on every Mac'
fi
if cat /etc/paths /etc/paths.d/* 2>/dev/null | grep -q '\.local/bin'; then
	world_changed macos-path-no-local-bin '.local/bin under home is not on the PATH macOS sets up' 'docs/install.md tells people to add it themselves'
else
	holds macos-path-no-local-bin '.local/bin under home is not on the PATH macOS sets up — why docs/install.md adds it'
fi

echo 'VLC'
if ! player_is_free; then
	:
elif [ -d /Applications/VLC.app ] && elect VLC org.videolan.vlc; then
	if [ "$(raw PlaybackRate)" = 1 ] && [ "$(field playing)" = false ]; then
		holds vlc-paused-rate 'paused, it still reports PlaybackRate 1 — why playing comes from localIsPlaying'
	else
		world_changed vlc-paused-rate 'VLC reports PlaybackRate 1 while paused' "it reports $(raw PlaybackRate): effectiveRate in src/core/logic/seek.js may no longer be needed for it"
	fi
	guard org.videolan.vlc
	"$bin" seek 22.4 >/dev/null 2>&1
	sleep 1
	if [ "$("$bin" position)" = 22.000 ]; then
		holds vlc-whole-seconds 'a seek to 22.4 lands on 22: it keeps whole seconds'
	else
		world_changed vlc-whole-seconds 'VLC keeps whole seconds' "seek 22.4 landed on $("$bin" position): test/live.test.sh allows for the old way"
	fi
	if command -v nowplaying-cli >/dev/null; then
		theirs=$(nowplaying-cli get elapsedTime)
		if [ "$theirs" = 0 ] && [ "$("$bin" get elapsedTime)" = 22 ]; then
			holds nowplaying-cli-elapsed "nowplaying-cli get elapsedTime is 0 where the position is 22 — the one thing docs/migrating.md says we do differently"
		else
			world_changed nowplaying-cli-elapsed 'nowplaying-cli get elapsedTime is always 0' "it says $theirs: docs/migrating.md should stop calling that a difference"
		fi
	fi
else
	echo '  skipped: VLC is not installed or did not become Now Playing' >&2
fi

echo 'QuickTime Player'
if ! player_is_free; then
	:
elif elect 'QuickTime Player' com.apple.QuickTimePlayerX; then
	if [ "$(raw PlaybackRate)" = 0 ]; then
		holds quicktime-paused-rate 'paused, it reports PlaybackRate 0, as IINA and browsers do'
	else
		world_changed quicktime-paused-rate 'QuickTime reports PlaybackRate 0 while paused' "it reports $(raw PlaybackRate)"
	fi
	guard com.apple.QuickTimePlayerX
	"$bin" seek 22.4 >/dev/null 2>&1
	sleep 1
	if [ "$("$bin" position)" = 22.400 ]; then
		holds quicktime-fractions 'a seek to 22.4 lands on 22.4: fractions are for the player to keep or drop'
	else
		world_changed quicktime-fractions 'QuickTime keeps fractions of a second' "seek 22.4 landed on $("$bin" position)"
	fi
	osascript -e 'tell application "QuickTime Player" to close every document saving no' >/dev/null 2>&1
else
	echo '  skipped: QuickTime Player did not become Now Playing' >&2
fi

echo 'Homebrew'
if command -v brew >/dev/null && brew trust --help >/dev/null 2>&1; then
	mkdir "$work/trust"
	if XDG_CONFIG_HOME=$work/trust HOMEBREW_NO_AUTO_UPDATE=1 brew install --dry-run servitola/tap/nowplayingseek 2>&1 | grep -q 'Trusted formula servitola/tap/nowplayingseek'; then
		holds homebrew-trust 'naming the formula in full trusts that one formula — the install line in the README is enough'
	else
		world_changed homebrew-trust 'brew install with the full name trusts the formula by itself' 'the README must tell people to run brew trust first'
	fi
else
	echo '  skipped: no Homebrew with tap trust here' >&2
fi
formulae=https://formulae.brew.sh/api/formula
case "$(answer $formulae/nowplaying-cli.json) $(answer $formulae/media-control.json)" in
'200 200') holds homebrew-core-has-them 'nowplaying-cli and media-control are in homebrew-core — the Install row of docs/compared.md' ;;
*000*) echo '  skipped: formulae.brew.sh does not answer' >&2 ;;
*) world_changed homebrew-core-has-them 'nowplaying-cli and media-control are in homebrew-core' 'the Install row of docs/compared.md says so' ;;
esac
case "$(answer $formulae/playerctl.json)" in
404) holds playerctl-not-in-homebrew 'Homebrew has no playerctl — docs/migrating.md says it has no build for the Mac' ;;
000) echo '  skipped: formulae.brew.sh does not answer' >&2 ;;
*) world_changed playerctl-not-in-homebrew 'Homebrew has no playerctl' 'docs/migrating.md says playerctl has no build for the Mac' ;;
esac

echo 'Karabiner-Elements'
karabiner=https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/to/shell-command/
if page=$(curl -fsSL --max-time 20 "$karabiner" 2>/dev/null); then
	if printf '%s' "$page" | tr -s ' \n' ' ' | grep -q 'the running command is forcibly terminated'; then
		holds karabiner-stops-command 'a shell_command still running is stopped when the next one starts — why docs/hotkeys.md ends every command in &'
	else
		world_changed karabiner-stops-command "$karabiner no longer says a running shell_command is terminated" 'docs/hotkeys.md links it for why every command ends in &'
	fi
else
	world_changed karabiner-stops-command "$karabiner does not answer" 'docs/hotkeys.md links it for why every command ends in &'
fi

echo 'The tools whose words we speak'
ours=$("$bin" media-control version | sed -n 's/^media-control \([^,]*\),.*/\1/p')
theirs=$(curl -fsS --max-time 20 https://api.github.com/repos/ungive/media-control/releases/latest 2>/dev/null | sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p')
if [ -z "$theirs" ]; then
	echo '  skipped: GitHub does not answer' >&2
elif [ "$theirs" = "$ours" ]; then
	holds media-control-version "media-control's latest release is $ours, the one whose commands docs/migrating.md counts"
else
	world_changed media-control-version "media-control's latest release is $ours" "it is $theirs: compare its commands with src/features/dialects/media-control.js and docs/migrating.md"
fi
stars=$(curl -fsS --max-time 20 https://api.github.com/repos/hnarayanan/shpotify 2>/dev/null | sed -n 's/.*"stargazers_count": *\([0-9]*\).*/\1/p')
if [ -z "$stars" ]; then
	echo '  skipped: GitHub does not answer' >&2
elif [ "$stars" -ge 2000 ]; then
	holds shpotify-stars "shpotify has $stars stars — docs/migrating.md says two thousand"
else
	world_changed shpotify-stars 'shpotify has two thousand stars' "it has $stars: docs/migrating.md"
fi

echo 'Links a reader is sent to'
links=$(sed -n 's/.*(\(https:\/\/www\.icloud\.com\/shortcuts\/[0-9a-f]*\)).*/\1/p;s/.*(\(https:\/\/support\.apple\.com\/[^)]*\)).*/\1/p' "$here/../docs/shortcuts.md")
dead=
for link in $links; do
	[ "$(answer "$link")" = 200 ] || dead="$dead $link"
done
if [ -z "$links" ]; then
	world_changed shortcut-links-answer 'docs/shortcuts.md links two ready-made shortcuts and an Apple guide' 'none was found in the page: this case reads them from it'
elif [ -z "$dead" ]; then
	holds shortcut-links-answer 'the ready-made shortcuts and the Apple guide in docs/shortcuts.md answer'
else
	world_changed shortcut-links-answer 'the links in docs/shortcuts.md answer' "these do not:$dead"
fi

if [ "$changed" -gt 0 ]; then
	echo "$changed of $beliefs beliefs about the world no longer hold" >&2
	exit 1
fi
echo "$beliefs beliefs about the world hold"
[ -z "$busy" ] || echo "the ones that need a player were skipped: $busy" >&2
