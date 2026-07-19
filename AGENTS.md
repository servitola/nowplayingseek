# nowplayingseek — agent rules

README.md explains what the tool is and why it has to run under `osascript`. Read its
"How it works" section before changing anything in `src/mediaremote.js` or `src/player.js`
— each of the three bullets there was a bug first.

- `src/core.js` stays free of `$` and `ObjC`: the test evaluates it on its own.
- A new decision goes into `core.js` as a pure function with a test; `player.js` only
  wires reads, calls and polling around those.
- `make test` needs no playback. Anything touching playback is checked by hand with a
  player running: `seek`, a held hotkey (five `forward` 30 ms apart must give +50 s),
  `toggle` twice, `backward` at 0, `seek` past the end.
- Release: bump `VERSION` in `src/cli.js`, tag `v<version>`, push, then update `url` and
  `sha256` in `~/projects/homebrew-tap/Formula/nowplayingseek.rb`.
