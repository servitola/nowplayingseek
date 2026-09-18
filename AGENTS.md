# nowplayingseek — agent rules

A command-line tool that reads and drives whatever macOS elected as Now Playing; people bind it
to hotkeys and call it from scripts, the owner holds a key to scrub through long videos.
`README.md` is the front door and `docs/` is the manual. Read `docs/how-it-works.md` before
touching `src/mediaremote.js` or `src/player.js` — each bullet there was a bug first. The README
stays under 100 lines: a new recipe, question or explanation goes into `docs/` and gets at most
a link. What is unfinished or undecided is in `BACKLOG.md`; this file holds only what stays true.

## Stack and layout

JavaScript for Automation under `/usr/bin/osascript`: no dependencies, no `package.json`, no
modules. `make` concatenates `src/` into one executable script, so a symbol declared in one file
is a plain global in the files after it. The order is the dependency order:

| File | Holds |
| --- | --- |
| `src/core.js` | pure: time, position and seek arithmetic, exit codes, `Failure` |
| `src/config.js` | pure: the `SETTINGS` table, ini and pattern parsing |
| `src/mediaremote.js` | the only file that touches the private `MediaRemote.framework` |
| `src/player.js` | seek and transport with polling for the effect; the last-seek store |
| `src/cli.js` | commands, usage, the config file, `run(argv)` — the entry point `osascript` calls |

`test/harness.js` and `test/*.test.js` are concatenated the same way into `build/test.js`;
`test/cli.test.sh` drives the built tool. Both lists are spelled out in the `Makefile`: a new file
in `src/` or `test/` is not built or run until it is added there.

## Commands and gates

`make build`, `make test` (prints `N passed` and `N cli cases passed`), `make lint` (every hook on
every tracked file; needs `pre-commit`), `make install PREFIX=~/.local`. `pre-commit install` once
after cloning; commits go through the hook, `--no-verify` and `SKIP=` are not used here. Run one
`pre-commit` at a time: it stashes unstaged changes while it works, and a second run in the same
tree fails with "files were modified by this hook".

- Biome with every stable rule as an error, plus its formatter; actionlint; shellcheck and shfmt.
  Versions are pinned in `.pre-commit-config.yaml`.
- What is switched off, and why a symbol from another file is not "undeclared", is in `biome.json`
  → `overrides`: a symbol used across files goes into the group's `globals`, one a file only
  exports into `noUnusedVariables.ignore`. The pure files get no `$` and no `ObjC`. A rule goes off
  only when it cannot hold for JXA — say why in the commit.
- No `*.js` in `src/` or `test/` over 200 physical lines (Biome's own rule skips the lines of a
  template literal, the hook does not). Functions: 50 lines, 4 parameters, complexity 15.

## Architecture rules

- A new decision goes into `core.js` or `config.js` as a pure function with a test; `player.js`
  only wires reads, calls and polling around them.
- A new tunable is one entry in `SETTINGS` — default, parser, `about` line. The config reader,
  `config`, `config init` and the unknown-key check derive from that table.
- Argument errors are raised before the player is touched, so that they can be tested.
- Comments say why, never what.

## Testing

- `make test` needs nothing playing. `test/cli.test.sh` runs each case under its own
  `XDG_CONFIG_HOME` (`NSHomeDirectory` ignores `HOME`) and covers exit 0, 64 and 78; exit 1 and 2
  depend on what is playing and are not tested.
- Anything touching playback is checked by hand with a player running — note the position and put
  it back: `seek`, a held hotkey (five `forward` 30 ms apart must give +50 s), `toggle` twice,
  `backward` at 0, `seek` past the end, and thirty `forward 1 --progressive` 60 ms apart under
  `XDG_CONFIG_HOME` with `pattern = 0.5s:x2, 1s:x3, ...` — the `×N` suffixes must climb and the
  distance moved must equal their sum. Do `seek` past the end last and on something disposable:
  it ends the item, and a page with autoplay loads the next one in its place.
- A change to the tests is proven by breaking the code once and watching them fail.

## Release

The `release` skill (`.claude/skills/release/SKILL.md`); `scripts/release.sh plan <version>` shows
what it would do. Nothing is pushed, tagged or published without the owner's word.

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
