# Backlog

What is left, most pressing first. State as of 2026-09-18; delete a line when it is done.

## Release 0.3.0
- Waits for the owner's "выпускай" and then goes by the `release` skill. First the local commits
  have to be pushed and CI has to be green on them — `scripts/release.sh check` blocks until then.
- `VERSION` on `main` still says 0.2.0 while `main` carries the 0.3.0 features; the release closes it.
- Phases 4–7 of the `release` skill (publish, tap, install, loose ends) have only ever run as
  `--dry-run`. Expect to correct the skill during the first real release.
- The `lint` job in `.github/workflows/test.yml` (`ubuntu-latest`, `pipx install pre-commit`) has
  never run: nothing was pushed since it was added. Watch it on the first push; actionlint is the
  only check it has passed.
- After `brew upgrade`, not before: switch the owner's Karabiner hotkeys to
  `forward --progressive` / `backward --progressive`.

## Bugs and oddities
- Once in ten tries `forward 1` right after two `toggle`s exited 2 ("ignored the seek"). Four
  repeats did not reproduce it, neither on that build nor on `2feb78e`. Not investigated.
- `config` loads `MediaRemote.framework` although it never reads Now Playing (~10 ms, harmless).

## Code
- `src/cli.js` is 192 lines of the 200 allowed. The next feature needs `configFile` moved out
  into its own file first.
- Biome is pinned to 2.5.13 because npm on the owner's machine refuses releases younger than
  7 days; 2.5.14 was 2 days old. Bump `rev`, `additional_dependencies` and `$schema` together.

## Questions for the owner
- Do the hotkeys work on the installed 0.2.0? Never confirmed.
- `brew "nowplaying-cli"` in the owner's brewfile is no longer used by anything — remove?
- The friend who got the old `audioctl.zip` could use `brew install servitola/tap/nowplayingseek`.
- Delete the branch `backup/lint-before-rewrite` once the lint pass is accepted.
