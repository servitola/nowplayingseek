# Backlog

What is left, most pressing first. State as of 2026-09-19; delete a line when it is done.

## Bugs and oddities
- Once in ten tries `forward 1` right after two `toggle`s exited 2 ("ignored the seek"). Four
  repeats did not reproduce it, neither on that build nor on `2feb78e`. Not investigated.
- Some pages ignore a seek to exactly 0 (the film site in Vivaldi during the 0.3.0 release; 0.2.0
  behaves the same, `seek 1` lands). `backward` near the start and `seek 0` exit 2 there. Probably
  a MediaSession handler that tests `seekTime` for truthiness.
- `seekLanded` allows 1 s of drift: a player that snaps to a keyframe further back exits 2 although
  it sought. Not seen in practice.
- `[hold] interval`, `max_multiplier` and the rest accept any number above zero: `interval = 1000` is taken.

## Code
- `get` and `get-raw` cannot be run against the fake player: `test/fake-mediaremote.js` answers
  `info()` with null and the nowplaying-cli dialect needs a dictionary. They are tested live only.
- Biome is pinned to 2.5.13 because npm on the owner's machine refuses releases younger than
  7 days; 2.5.14 was 2 days old. Bump `rev`, `additional_dependencies` and `$schema` together.

## Questions for the owner
- The knob is not remapped on the owner's keyboard: `--knob` has met simulated clicks only.
- The Hammerspoon and skhd recipes have been checked for syntax, never pressed.
- The Shortcuts walkthrough in the README was written from Apple's documentation and never clicked
  through: the names of the buttons and the prompt for "Allow Running Scripts" want one real run.
- The friend who got the old `audioctl.zip` could use `brew install servitola/tap/nowplayingseek`.
