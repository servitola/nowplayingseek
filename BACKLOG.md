# Backlog

What is left, most pressing first. State as of 2026-08-18; delete a line when it is done.

## Bugs and oddities
- Once in ten tries `forward 1` right after two `toggle`s exited 2 ("ignored the seek"). Four
  repeats did not reproduce it, neither on that build nor on `2feb78e`. Not investigated.
- Some pages ignore a seek to exactly 0 (the film site in Vivaldi during the 2026.07.31 release; 2026.07.21
  behaves the same, `seek 1` lands). `backward` near the start and `seek 0` exit 2 there. Probably
  a MediaSession handler that tests `seekTime` for truthiness.
- At knob or key-repeat pace a Now Playing refresh caused by an older seek carries a timestamp later
  than the newest `lastSeek.at`, so `seekBase` trusts a stale position and a click is lost. From the
  review of 2026-08-18, plausible, not measured; a fix would also require the position to be near the
  last target for the first 0.3 s.
- `seekLanded` allows 1 s of drift: a player that snaps to a keyframe further back exits 2 although
  it sought. Not seen in practice.
- `[hold] interval`, `max_multiplier` and the rest accept any number above zero, `1:30` included.

## Code
- Biome is pinned to 2.5.13 because npm on the owner's machine refuses releases younger than
  7 days; 2.5.14 was 2 days old. Bump `rev`, `additional_dependencies` and `$schema` together.

## Questions for the owner
- `⌃⇧⇪X/Z` now call `forward/backward 10 --progressive` on 2026.07.31 — confirm a tap and a hold both work.
- The friend who got the old `audioctl.zip` could use `brew install servitola/tap/nowplayingseek`.
