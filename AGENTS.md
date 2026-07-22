# nowplayingseek — agent rules

A command-line tool that reads and drives whatever macOS elected as Now Playing — the item in the
Control Center media widget: position, exact seek, relative seek, transport. People bind it to
hotkeys (Karabiner, Shortcuts) and call it from scripts; the owner holds a key to scrub through
long videos. `README.md` is the user manual; its "How it works" and "Limits" explain why the
tool is a script for `osascript` and cannot be anything else. Read them before touching
`src/mediaremote.js` or `src/player.js` — each bullet there was a bug first.

## Stack and layout

JavaScript for Automation, run by `/usr/bin/osascript`. No dependencies, no `package.json`, no
modules: `make` concatenates `src/` into one executable script, so a symbol declared in one
file is a plain global in the files after it. The order is the dependency order:

| File | Holds |
| --- | --- |
| `src/core.js` | pure: time, position and seek arithmetic, exit codes, `Failure` |
| `src/config.js` | pure: the `SETTINGS` table, ini and pattern parsing |
| `src/mediaremote.js` | the only file that touches the private `MediaRemote.framework` |
| `src/player.js` | seek and transport with polling for the effect; the last-seek store |
| `src/cli.js` | commands, usage, the config file, `run(argv)` — the entry point `osascript` calls |

`test/harness.js`, `test/core.test.js`, `test/config.test.js` are concatenated the same way into
`build/test.js`; `test/cli.test.sh` drives the built tool. `scripts/` has the release script and
the file-length hook. `build/` is ignored.

## Commands

```sh
make build     # build/nowplayingseek
make test      # pure-function tests, then CLI tests; prints "N passed" and "N cli cases passed"
make lint      # pre-commit run --all-files; needs pre-commit (brew install pre-commit)
make install PREFIX=~/.local
```

`pre-commit install` once after cloning makes `git commit` run the hooks on the staged files;
`make lint` runs the same hooks on every tracked file and needs no install. Every commit goes
through the hook: `--no-verify` and `SKIP=` are not used here. Run one `pre-commit` at a time —
it stashes unstaged changes while it works, and a second run in the same tree sees files change
under it and fails with "files were modified by this hook".

## Gates

- Biome 2.5.13 with every stable rule as an error, plus its formatter; actionlint for the
  workflow; shellcheck and shfmt for `*.sh`. Versions are pinned in `.pre-commit-config.yaml`.
- The few rules that are off, and the per-file lists that make the concatenation model visible to
  the linter, live in `biome.json` → `overrides`. A symbol used from another file goes into that
  file's `globals`; a symbol a file only exports goes into its `noUnusedVariables.ignore`. A rule
  is switched off only when it cannot hold for JXA — say why in the commit.
- No `*.js` in `src/` or `test/` over 200 physical lines (`scripts/check-file-length.sh`; Biome's
  own rule skips lines inside template literals). Functions: 50 lines, 4 parameters, cognitive
  complexity 15.

## Architecture rules

- `core.js` and `config.js` stay free of `$` and `ObjC`: the tests evaluate the two on their own.
- A new decision goes into one of those two as a pure function with a test; `player.js` only
  wires reads, calls and polling around them.
- A new tunable is one entry in `SETTINGS` in `config.js` — default, parser, `about` line. The
  config reader, `config`, `config init` and the unknown-key check derive from that table; add the
  key to the sample in README "Advanced".
- Argument errors are raised before the player is touched, so that they can be tested.
- Comments say why, never what.

## Testing

- `make test` needs nothing playing. JS tests cover the pure functions. `test/cli.test.sh` covers
  exit codes 0, 64 and 78, usage errors and everything around the config file, each case under
  its own `XDG_CONFIG_HOME` (`NSHomeDirectory` ignores `HOME`). Exit 1 and 2 depend on what is
  playing and are not tested there.
- Anything touching playback is checked by hand with a player running — it moves what the owner
  is listening to, so note the position and put it back: `seek`, a held hotkey (five `forward`
  30 ms apart must give +50 s), `toggle` twice, `backward` at 0, `seek` past the end, and thirty
  `forward 1 --progressive` 60 ms apart under `XDG_CONFIG_HOME` with
  `pattern = 0.5s:x2, 1s:x3, ...` — the `×N` suffixes must climb and the distance moved must
  equal their sum.
- A change to the tests is proven by breaking the code once and watching them fail.

## Release

Use the `release` skill (`.claude/skills/release/SKILL.md`); `scripts/release.sh --dry-run plan
<version>` shows what it would do. Nothing is pushed, tagged or published without the owner's
explicit word in the conversation.

## Dead ends — measured 2026-07-23 on macOS 26.6, do not retry
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
