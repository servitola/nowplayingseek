#!/bin/sh
set -eu

repo=servitola/nowplayingseek
tap_dir=${TAP_DIR:-$HOME/projects/homebrew-tap}
formula=Formula/nowplayingseek.rb
version_file=src/cli.js
changelog=CHANGELOG.md

usage() {
	cat <<EOF
usage: scripts/release.sh [--dry-run] <step>

  check              preflight: branch, clean tree, in sync with origin, lint, tests, CI on HEAD
  bump <version>     write <version> into $version_file and cut it out of Unreleased in $changelog
  formula <version>  download the published tarball, put its sha256 and url into the tap formula
  notes <version>    print that version's section of $changelog, for the GitHub release
  plan <version>     all three with --dry-run

Nothing here commits, tags or pushes. --dry-run changes no file either: it prints the diff.
The tap checkout is \$TAP_DIR, $tap_dir by default.
EOF
}

dry_run=false
blocked=0

say() { printf '%s\n' "$*"; }
ok() { say "  ok    $*"; }
blocker() {
	say "  BLOCK $*"
	blocked=$((blocked + 1))
}
die() {
	say "release: $*" >&2
	exit 1
}

current_version() {
	sed -n "s/^const VERSION = '\(.*\)';$/\1/p" "$version_file"
}

apply() {
	target=$1 edited=$2
	diff -u "$target" "$edited" | sed "1s|.*|--- $target|; 2s|.*|+++ $target (after)|" || true
	# Not mv: mktemp makes the copy 0600, and brew style rejects a formula nobody else can read.
	$dry_run || cat "$edited" >"$target"
	rm -f "$edited"
}

check() {
	say "preflight at $(git rev-parse --short HEAD):"
	branch=$(git rev-parse --abbrev-ref HEAD)
	if [ "$branch" = main ]; then ok "on main"; else blocker "on $branch, releases are cut from main"; fi

	if [ -z "$(git status --porcelain)" ]; then ok "working tree is clean"; else blocker "working tree is not clean"; fi

	git fetch --quiet origin main
	ahead=$(git rev-list --count origin/main..HEAD)
	behind=$(git rev-list --count HEAD..origin/main)
	if [ "$ahead" -eq 0 ] && [ "$behind" -eq 0 ]; then
		ok "in sync with origin/main"
	else
		blocker "$ahead ahead of and $behind behind origin/main — CI has not seen this HEAD"
	fi

	if make lint >/dev/null 2>&1; then ok "make lint"; else blocker "make lint fails"; fi
	if make test >/dev/null 2>&1; then ok "make test"; else blocker "make test fails"; fi

	runs=$(gh run list --repo "$repo" --commit "$(git rev-parse HEAD)" --json conclusion --jq '.[].conclusion' 2>/dev/null || true)
	if [ -z "$runs" ]; then
		blocker "no CI run for HEAD on GitHub"
	elif [ -n "$(say "$runs" | grep -v '^success$' || true)" ]; then
		blocker "CI on HEAD is not green: $(say "$runs" | tr '\n' ' ')"
	else
		ok "CI on HEAD is green"
	fi
}

validate_version() {
	say "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || die "\"$1\" is not YYYY.MM.DD"
	current=$(current_version)
	newest=$(printf '%s\n%s\n' "$current" "$1" | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)
	if [ "$1" = "$current" ] || [ "$newest" != "$1" ]; then die "$1 is not above the current $current"; fi
	if git rev-parse -q --verify "refs/tags/v$1" >/dev/null; then die "tag v$1 already exists"; fi
}

bump() {
	version=$1
	grep -q '^## Unreleased$' "$changelog" || die "$changelog has no \"## Unreleased\" section"
	notes=$(sed -n '/^## Unreleased$/,/^## [0-9]/p' "$changelog" | sed '1d;$d' | grep -c '[^[:space:]]' || true)
	[ "$notes" -gt 0 ] || die "Unreleased in $changelog is empty — nothing to release"

	say "bump $(current_version) -> $version:"
	edited=$(mktemp)
	sed "s/^const VERSION = '.*';$/const VERSION = '$version';/" "$version_file" >"$edited"
	apply "$version_file" "$edited"

	edited=$(mktemp)
	awk -v heading="## $version — $(date +%Y-%m-%d)" '{ print } /^## Unreleased$/ { print ""; print heading }' "$changelog" >"$edited"
	apply "$changelog" "$edited"
}

notes() {
	section=$(awk -v start="## $1 " 'index($0, start) == 1 { inside = 1; next } /^## / { inside = 0 } inside' "$changelog")
	[ -n "$section" ] || die "$changelog has no section for $1"
	# GitHub renders a newline inside a release body as a line break, so wrapped lines are joined.
	say "$section" | sed -e '/./,$!d' | awk '
		/^(- |#|$)/ { if (line != "") print line; line = ""; if ($0 ~ /^(#|$)/) { print; next } }
		{ sub(/^ +/, ""); line = (line == "" ? $0 : line " " $0) }
		END { if (line != "") print line }'
}

update_formula() {
	version=$1
	[ -f "$tap_dir/$formula" ] || die "no $formula in $tap_dir — set TAP_DIR to the tap checkout that pushes to origin"
	url="https://github.com/$repo/archive/refs/tags/v$version.tar.gz"

	tarball=$(mktemp)
	if curl -fsL -o "$tarball" "$url"; then
		sha=$(shasum -a 256 "$tarball" | cut -d' ' -f1)
	elif $dry_run; then
		sha="<sha256 of the tarball GitHub serves once v$version is pushed>"
	else
		rm -f "$tarball"
		die "$url is not there yet — push the tag first"
	fi
	rm -f "$tarball"

	say "formula in $tap_dir:"
	edited=$(mktemp)
	sed -e "s|^  url \".*\"$|  url \"$url\"|" -e "s|^  sha256 \".*\"$|  sha256 \"$sha\"|" "$tap_dir/$formula" >"$edited"
	apply "$tap_dir/$formula" "$edited"
}

if [ "${1:-}" = --dry-run ]; then
	dry_run=true
	shift
fi
step=${1:-}
cd "$(dirname "$0")/.."

case $step in
check)
	check
	;;
notes)
	[ $# -eq 2 ] || die "$step needs a version"
	notes "$2"
	;;
bump | formula | plan)
	[ $# -eq 2 ] || die "$step needs a version"
	case $step in
	bump)
		validate_version "$2"
		bump "$2"
		;;
	formula)
		[ "$2" = "$(current_version)" ] || die "$2 is not the version in $version_file, $(current_version) — bump first"
		update_formula "$2"
		;;
	plan)
		validate_version "$2"
		dry_run=true
		check
		bump "$2"
		update_formula "$2"
		;;
	esac
	;;
-h | --help | '')
	usage
	exit 0
	;;
*)
	usage >&2
	exit 64
	;;
esac

if [ "$blocked" -gt 0 ]; then
	say "release: $blocked blocker(s) — a real release stops here"
	exit 1
fi
