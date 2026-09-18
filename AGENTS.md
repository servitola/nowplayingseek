# nowplayingseek — agent rules

README.md explains what the tool is and why it has to run under `osascript`. Read its
"How it works" section before changing anything in `src/mediaremote.js` or `src/player.js`
— each of the three bullets there was a bug first.

- `src/core.js` stays free of `$` and `ObjC`: the test evaluates it on its own.
- A new decision goes into `core.js` as a pure function with a test; `player.js` only
  wires reads, calls and polling around those.
- A new tunable is one entry in `SETTINGS` in `core.js` — default, parser, `about` line. The
  config reader, `config`, `config init` and the unknown-key check all derive from that table;
  add the key to the sample in README "Config".
- `make test` needs no playback. Anything touching playback is checked by hand with a
  player running: `seek`, a held hotkey (five `forward` 30 ms apart must give +50 s),
  `toggle` twice, `backward` at 0, `seek` past the end, and thirty `forward 1 --progressive`
  60 ms apart under `XDG_CONFIG_HOME` with `pattern = 0.5s:x2, 1s:x3, ...` — the `×N` suffixes
  must climb and the distance moved must equal their sum.
- Release: bump `VERSION` in `src/cli.js`, tag `v<version>`, push, then update `url` and
  `sha256` in `~/projects/homebrew-tap/Formula/nowplayingseek.rb`.

## Dead ends — measured 2026-09-18 on macOS 26.6, do not retry
- **Addressing a non-elected player.** Five routes (`MRNowPlayingRequest initWithPlayerPath:`,
  `MRMediaRemoteSendCommandToPlayer` with a plain and with a resolved `MRPlayerPath`,
  `…SendCommandToApp`, `…SendCommandToClient`), all through perl + a compiled arm64e helper
  because JXA cannot pass blocks. A seek addressed to Vivaldi or IINA landed on the elected
  Music every time; only Music itself is addressed as asked. vorssaint-utils documents the same:
  "The service may redirect unprivileged requests to the global player."
- **`MRMediaRemoteSetOverriddenNowPlayingApplication` / `…SetNowPlayingApplicationOverrideEnabled`.**
  Never call them. They elect nobody and leave `mediaremoted` with no elected app at all —
  playback starting in other apps no longer elects them, and turning the override off does
  not help. The only fix was `sudo killall mediaremoted`.
- **A helper dylib inside `osascript`.** Refused: "mapping process is a platform binary, but
  mapped file is not". perl accepts one, but needs an arm64e slice.

The tool therefore drives the elected app and only that. This is a decision, not a gap.
