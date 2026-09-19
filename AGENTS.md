# nowplayingseek — agent rules

A command-line tool that reads and drives whatever macOS elected as Now Playing; people bind it
to hotkeys and call it from scripts, the owner holds a key to scrub through long videos.
`README.md` is the front door and `docs/` is the manual. Read `docs/how-it-works.md` before
touching `src/mediaremote.js` or `src/player.js` — each bullet there was a bug first. The README
stays under 100 lines: a new recipe, question or explanation goes into `docs/` and gets at most
a link. What is unfinished or undecided is in `BACKLOG.md`; this file holds only what stays true.

## Stack and layout

JavaScript for Automation under `/usr/bin/osascript`: no dependencies, no `package.json`, no
modules. `make` concatenates the sources into one executable script, so a symbol declared in one
file is a plain global in the files after it. The order in the `Makefile` is the order of the
layers, and a layer uses only the layers above it in this list:

```
src/logic/      knows nothing of macOS — every function here has a unit test
    time.js         parse and print a time; exit codes; Failure
    seek.js         where a step starts, whether it landed, whether an older seek overtook it
    hold.js         a held key and its release; the --progressive curve; the pace of a knob
    stream.js       what changed between two reads
    paint.js        what a terminal gets: the status line, the help page, JSON, ini — bold, dim, one hue
    words.js        the seek words of playerctl and mpc; playerctl's format strings
    config.js       the SETTINGS table; ini
src/system/     the only place with $ and ObjC
    mediaremote.js  read Now Playing, send commands — the private framework lives here alone
    files.js        the temp files processes talk through, and the lock
    terminal.js     is stdout a terminal; an app's name from its bundle id
    configfile.js   find, load and write config.ini
src/player.js   a step, a hold, waiting for the player — ties logic to system
src/dialects/   one file a tool; they call player and system, never each other's insides
    nowplaying-cli.js   media-control.js (+ -read.js, -help.js)   playerctl.js   mpc.js
    shpotify.js   shared.js (refuse, unknown, move)   index.js (which first word is which tool)
src/cli.js      our own commands, `run(argv)` — the entry point `osascript` calls
src/usage.js    the help page; after cli.js, because it names the version
```

`test/harness.js` and `test/*.test.js` are concatenated the same way into `build/test.js` and run
over `src/logic/`; `test/cli.test.sh` drives the built tool without a player; `test/live.test.sh`
drives VLC. The lists are spelled out in the `Makefile`: a new file is not built or run until it is
added there, and its globals are listed in `biome.json`.

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
  exports into `noUnusedVariables.ignore`. `src/logic/` gets no `$` and no `ObjC`. A rule goes off
  only when it cannot hold for JXA — say why in the commit.
- No `*.js` in `src/` or `test/` over 200 physical lines (Biome's own rule skips the lines of a
  template literal, the hook does not). Functions: 50 lines, 4 parameters, complexity 15.

## Architecture rules

- A new decision goes into `src/logic/` as a pure function with a test; `player.js` only wires
  reads, calls and polling around them.
- A new tunable is one entry in `SETTINGS` — default, parser, `about` line. The config reader,
  `config`, `config init` and the unknown-key check derive from that table.
- Argument errors are raised before the player is touched, so that they can be tested.
- Comments say why, never what.

## Testing

- `make test-live` opens VLC on five minutes of generated silence, pauses it and walks the playback
  cases; it refuses to start while something is playing and stops the moment Now Playing goes to
  another app. Run it before a release; whatever it does not cover stays in the hand checklist below.
- `make test` needs nothing playing. `test/cli.test.sh` runs each case under its own
  `XDG_CONFIG_HOME` (`NSHomeDirectory` ignores `HOME`) and covers exit 0, 64 and 78; exit 1 and 2
  depend on what is playing and are not tested.
- Anything touching playback is checked by hand with a player running — look at `playing` first and
  never on something the owner is watching; note the position and put it back: `seek`, a held hotkey
  (five `forward` 30 ms apart must give +50 s), `toggle` twice, `backward` at 0, a hold (`forward 10
  --hold &`, `release` 1.2 s later must give +60 s; `release` 80 ms later, +10 s; with `[hold]
  max_time = 1` and no `release` it must return by itself), a progressive hold (`forward --hold
  --progressive`, `release` 3 s later: about +88 s and the line ends with `×0.8`), a knob (five
  `forward --knob` 0.5 s apart: about +10 s; ten 50 ms apart: +35…80 s), and `seek` past the
  end. Do `seek` past the end last and on something disposable: it ends the item, and a page with
  autoplay loads the next one in its place.
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
