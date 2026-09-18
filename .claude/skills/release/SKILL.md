---
name: release
description: |
  Releases nowplayingseek end to end: preflight, version and changelog, the owner's go-ahead,
  tag and push, the Homebrew formula in servitola/tap, and the upgraded install on this Mac.

  Use when: "выпускай", "выпусти релиз", "сделай релиз", "выкати новую версию", "обнови формулу",
  "release it", "cut a release", "ship 2026.09.20", "bump the version and publish"
---

# Releasing nowplayingseek

`scripts/release.sh` does the mechanical steps and never commits, tags or pushes; this skill
supplies the judgement and the order. Everything that leaves the machine waits for the owner's
"yes" in Phase 3, because a pushed tag cannot be taken back once Homebrew has seen its tarball.

The live checks drive whatever is playing on this Mac. That is intended; note the position
first (`nowplayingseek position`) and put it back when you are done.

## Phase 1: Preflight

1. `scripts/release.sh check`. A `BLOCK` line stops the release; fix the cause, then re-run it.
   Local commits the CI has not seen are a blocker by design: pushing them is the owner's call.
2. The last CI run carries no annotations — a deprecation warning today is a red run later. This
   prints nothing when clean:
   `for id in $(gh api repos/servitola/nowplayingseek/commits/main/check-runs --jq '.check_runs[].id'); do gh api repos/servitola/nowplayingseek/check-runs/$id/annotations --jq '.[].message'; done`
3. Read the run yourself when the script reports CI as not green: `gh run list --repo
   servitola/nowplayingseek --limit 5`, `gh run view <id> --log-failed`.
4. Walk the live checklist in `AGENTS.md` ("Testing") with a player running. `status` exit 1 means
   nothing is playing: ask the owner to start something. Record which items ran; an item that did
   not run is reported as skipped, not passed.

**Checkpoint:** every `check` line is `ok`; the live checklist ran or the owner waived it in words.

## Phase 2: Version and changelog

1. Read `git log --oneline v<last>..HEAD` and `CHANGELOG.md` → `## Unreleased`. Every user-visible
   change since the last tag has a line there; add the missing ones (Added / Changed / Fixed).
2. The version is today's date, `YYYY.MM.DD` (Cyprus time). Releasing twice in one day is not
   planned; if it ever happens, suffix the second release `.1` and first extend the version
   regex in `scripts/release.sh`, which does not accept a fourth dot-part yet (see below).
3. `scripts/release.sh plan <version>` previews everything without writing (`--dry-run`, where
   used, is the first argument). Read the diff, then `scripts/release.sh bump <version>`.
4. `make test` (the CLI tests compare `--version` with `src/cli.js`), then commit exactly
   `src/cli.js` and `CHANGELOG.md` as `nowplayingseek <version>`. No tag yet: `push.followTags`
   is on for this machine, so a tag would ride along with the next push.

**Checkpoint:** one new local commit, `build/nowplayingseek --version` prints `<version>`, no tag.

## Phase 3: Stop gate

1. Show the owner: the version and why, the `## <version>` section of `CHANGELOG.md` as it will
   be published, `git show --stat HEAD`, and what happens next — push `main`, tag and push
   `v<version>`, formula commit pushed to the tap.
2. Wait for an explicit yes. Anything else means stop here; the bump commit is local and can stay
   or be reset.

**Checkpoint:** the owner's "yes" is in this conversation, after the summary.

## Phase 4: Publish

1. `git push origin main`, then wait for the `test` workflow on that commit: `gh run watch` or
   `gh run list --commit <sha>`. Red means fix on `main` and start over; no tag exists yet.
2. `git tag -a v<version> -m "nowplayingseek <version>"`, `git push origin v<version>`. `test.yml`
   does not run on tags; that push instead triggers `.github/workflows/release.yml`: it builds on
   macOS, runs `make lint test`, then `make dist` (the script plus a universal artwork bundle,
   LICENSE, README, a `.sha256`), attests build provenance for the tarball, and creates (or, if
   the release already exists, updates) the GitHub release for this tag with those two files
   attached and the notes taken from `scripts/release.sh notes <version>`.
3. `gh run list --repo servitola/nowplayingseek --workflow release.yml --branch v<version> --limit 1`
   until it shows a conclusion, then `gh run view <id> --log-failed` if it is not `success`. Red
   here means the tag is burned (tags are not re-pushed, see `references/rollback.md`) — fix and
   release the next patch version, do not retry this tag.
4. `gh release view v<version> --json assets --jq '.assets[].name'` names the tarball and the
   `.sha256`; `gh release list` shows the release as Latest. `gh attestation verify
   <a downloaded copy of the tarball> --owner servitola` confirms the provenance signature.
5. `scripts/release.sh --dry-run formula <version>` shows the tap formula diff with the sha256 of
   the *source* tarball it downloaded — the Homebrew formula still builds from source, unrelated
   to the release asset above; see Phase 5. A `<sha256 of the tarball…>` placeholder in place of
   64 hex characters means GitHub is not serving the source archive yet: wait and retry.

**Checkpoint:** tag and release on GitHub, `release.yml` green with the tarball and checksum
attached and attested, the dry run of `formula` shows a real 64-hex sha256.

## Phase 5: Tap

The tap is developed in `~/projects/homebrew-tap`. Its `origin` is private; GitHub is a
force-mirror of it and only ever receives that mirror. `$(brew --repo servitola/tap)` is
Homebrew's own clone of the GitHub side: read-only, commits go to the checkout below.

0. `TAP_DIR=${TAP_DIR:-$HOME/projects/homebrew-tap}` — the script has the same default, the shell
   you type the next commands into does not.
1. `scripts/release.sh formula <version>` rewrites `url` and `sha256` in `Formula/nowplayingseek.rb`.
2. `brew style "$TAP_DIR/Formula/nowplayingseek.rb"`.
3. Prove the formula before anyone else gets it. Homebrew audits and installs only from its own
   clone, so stage the file there and put the clone back afterwards, or `brew update` cannot
   fast-forward:
   ```sh
   export HOMEBREW_NO_AUTO_UPDATE=1; clone=$(brew --repo servitola/tap)
   cp "$TAP_DIR/Formula/nowplayingseek.rb" "$clone/Formula/"
   brew audit --strict --online servitola/tap/nowplayingseek
   brew upgrade --build-from-source servitola/tap/nowplayingseek && brew test servitola/tap/nowplayingseek
   git -C "$clone" checkout -- Formula/nowplayingseek.rb
   ```
4. Commit only that file as `nowplayingseek <version>` — the checkout may hold the owner's
   unrelated edits — and `git -C "$TAP_DIR" push origin main`.
5. Wait for the mirror (`git ls-remote https://github.com/servitola/homebrew-tap main` equals the
   new commit; it took about 20 s), then for `brew test-bot`: `gh run list --repo servitola/homebrew-tap --limit 3`.
   It audits the formula with `--strict --online`, installs it from source and runs `brew test`.

**Checkpoint:** tap CI green on the formula commit.

## Phase 6: Install and verify here

1. `brew update && brew upgrade servitola/tap/nowplayingseek`. Phase 5 step 3 already installed
   it, so this is a no-op that proves the published tap and the installed keg agree: `brew
   outdated` stays empty and `brew info` names `<version>`.
2. `/opt/homebrew/bin/nowplayingseek --version` prints `<version>`; `nowplayingseek doctor` is ok.
3. With something playing: `status --json`, `forward 10`, `backward 10`, `forward 10 --progressive`,
   then `seek` back to where it was.

**Checkpoint:** the installed binary reports `<version>` and both live commands exit 0.

## Phase 7: Loose ends

1. Hotkeys: the owner's Karabiner rules call this CLI by full path. If a command or flag they use
   changed, tell him which line to change — after `brew upgrade`, never before, or the hotkeys
   call a command that is not installed yet. Karabiner lives in his dotfiles; edit it only on request.
2. Update the `## Handoff` section of `~/projects/serho_topics/аудио-управлятор/CLAUDE.md` with the
   released version and what is left open.

**Checkpoint:** the handoff names `<version>`; the owner knows of any hotkey line to change.

**Something failed after Phase 3?** Follow [rollback.md](references/rollback.md) — tag pushed
but formula not, sha256 mismatch, red tap CI, a bad release already installed.

## Final check

- [ ] every phase checkpoint held, and the owner's yes came before the first push
- [ ] source CI and tap CI are green on the release commits
- [ ] skipped live checks are named as skipped in the final report
