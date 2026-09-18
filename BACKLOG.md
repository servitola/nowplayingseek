# Backlog

What is left, most pressing first. State as of 2026-09-18; delete a line when it is done.

## Bugs and oddities
- Once in ten tries `forward 1` right after two `toggle`s exited 2 ("ignored the seek"). Four
  repeats did not reproduce it, neither on that build nor on `2feb78e`. Not investigated.
- Some pages ignore a seek to exactly 0 (the film site in Vivaldi during the 0.3.0 release; 0.2.0
  behaves the same, `seek 1` lands). `backward` near the start and `seek 0` exit 2 there. Probably
  a MediaSession handler that tests `seekTime` for truthiness.
- `config` loads `MediaRemote.framework` although it never reads Now Playing (~10 ms, harmless).

## Code
- `src/cli.js` is 192 lines of the 200 allowed. The next feature needs `configFile` moved out
  into its own file first.
- Biome is pinned to 2.5.13 because npm on the owner's machine refuses releases younger than
  7 days; 2.5.14 was 2 days old. Bump `rev`, `additional_dependencies` and `$schema` together.

## Questions for the owner
- `⌃⇧⇪X/Z` now call `forward/backward 10 --progressive` on 0.3.0 — confirm a tap and a hold both work.
- The friend who got the old `audioctl.zip` could use `brew install servitola/tap/nowplayingseek`.
