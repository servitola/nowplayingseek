# Development

[← README](../README.md)

<p align="center"><img src="images/banner-development.webp" alt="The panda tightens a bolt inside an opened glass player; three test lamps beside it glow green" width="100%"></p>

One script for `osascript`, no dependencies at run time. `make` concatenates `src/` into
`build/nowplayingseek`; there are no modules, so the order in the `Makefile` is the dependency order.

| | |
| --- | --- |
| `make build` | the tool, in `build/` |
| `make install PREFIX=~/.local` | the tool and its short name `nps` |
| `make test` | the logic under `osascript`, then every argument and the whole tool against a player that is a file. It cannot reach a real player |
| `make test-speed` | wall-clock time of each command against the fake player, min/median/max over 21 runs — the hotkey feels the median. Not part of `make test`: see below |
| `make test-live` | the real thing: VLC on generated silence. It refuses to start while something is playing |
| `make test-world` | what the project believes about VLC, QuickTime, macOS and Homebrew, checked against them |
| `make lint` | Biome with every stable rule as an error, shellcheck, shfmt, actionlint. Needs `pre-commit` and `node` |
| `make globals` | rewrites the lists in `biome.json` after a name starts to cross files |
| `make coverage` | lines of logic the unit tests never reach |
| `make typecheck` | TypeScript's checker over the built file |
| `make dist` | the release tarball in `dist/`: the script, the universal artwork bundle, LICENSE, README, and a `.sha256` beside it. What `.github/workflows/release.yml` runs on a pushed tag; [docs/install.md](install.md) is the reader-facing side |

`pre-commit install` once after cloning; commits go through the hook.

### Layout

`src/` is the core — reading Now Playing and moving it — and `src/features/` is optional: a
feature is anything core never calls, whatever its folder or file name suggests. Core declares an
extension point (`COMMANDS`, `dialectRouter`, `RENDERERS`) and a feature registers into it at its
own file's bottom; core never names a feature file. The rule is enforced, not kept by discipline:
`scripts/globals.js --check` fails `make lint` when a `CORE`-listed file references a symbol
declared only under a `FEATURES`-listed one. Fix a violation by pulling what core needs into a
core file, leaving the rest optional. The file-by-file map, kept accurate as of the September 2026
core/feature refactor:

```
src/logic/      knows nothing of macOS — every function here has a unit test
    time.js         parse and print a time; exit codes; Failure
    seek.js         where a step starts, whether it landed, whether an older seek
                    overtook it
    hold.js         a held key and its release; the --progressive curve; the pace of
                    a knob
    stream.js       what changed between two reads — status.js's own stream diffs
                    with this too
    item.js         the order of --raw; the chapter as 6/13; the `human` block
    text.js         fitting a line to the terminal width; stripping paint to measure
                    it
    paint.js        what a terminal gets: the status line, the help page, JSON, ini
                    — bold, dim and the sixteen colours, each with a meaning
    config.js       the SETTINGS table; reading and resolving an ini — read on
                    every command;
                    authoring one (config init, config set) is a feature, see
                    src/features/config/
src/system/     the only place with $ and ObjC
    mediaremote.js  read Now Playing, send commands — the private framework lives
                    here alone
    artwork.js      shells out to /usr/bin/perl for the one thing osascript cannot
                    read
    files.js        the temp files processes talk through, and the lock
    terminal.js     is stdout a terminal; an app's name from its bundle id
    configfile.js   find, load config.ini — read only; writing one is a feature
src/player.js   a step, a hold, waiting for the player — ties logic to system
src/player-commands.js   requireState, requirePosition, send — simple dispatch to
                         mediaRemote
src/player-artwork.js    the artwork() primitive, fetched through system/artwork.js
src/status.js   status.get()/status.stream(): the JSON payload of media-control's
                own `get` and
                `stream`, and mediaControlSeek(), its own seek — the native
                `status --json`,
                `stream`, `seek --micros` and the hidden `get` all reach these, so
                this dialect's
                own vocabulary stays core even though speaking it as a dialect is a
                feature.
                `stream` paints in a terminal only if RENDERERS.watch is set, else
                the plain JSON
                it always emits for a pipe
src/native-get.js   nowplaying-cli's own shape for `get`/`get-raw` — the same
                story as status.js, for the other dialect two native commands are
                secretly implemented by
src/output.js   how a command answers: a line, `--json`, `--minify`, `--raw` — one
                contract for all of them
src/args.js     what a command may take: SPEAKING, FLAGS, seekCommand — cli.js is
                dispatch alone
src/cli.js      our own commands, `run(argv)` — the entry point `osascript` calls;
                declares
                COMMANDS, dialectRouter and RENDERERS, the extension points features
                register into
src/usage.js    the help page; after cli.js, because it names the version
src/features/config/   authoring config.ini — init, set, the template
    settings-authoring.js   formatSettings, the template, config-set parsing,
                            rewriting a line of ini
    configfile.js           Object.assign(configFile, {init, set, write})
    command.js               COMMANDS.config = (...), self-registered
src/features/dialects/   one file a tool; they call player, system, status and
                native-get, never each other's insides, and never the reverse
    words.js                 the seek words of playerctl and mpc; playerctl's format
                             strings
    nowplaying-cli.js   media-control.js (+ -help.js)   playerctl.js   mpc.js
    shpotify.js   shared.js (refuse, unknown, move, stop)
    index.js                 DIALECTS (which first word is which tool);
                             dialectRouter.current =
                              dialectFor, the one line that hands core its hook into
                              this folder
src/features/watch/   the live, painted terminal rendering of `watch` and of
                      `stream`
    change.js                 what happened between two reads, in a word —
                              describeChange, logOf
    loop.js                   the `watching` object (was src/watch.js); sets
                              RENDERERS.watch and,
                              through it, COMMANDS.watch — core never names
                              `watching` itself
```

`native/artwork.m` sits outside that list: clang builds it into `build/nowplayingseek-artwork.bundle`,
which `src/system/artwork.js` loads into `/usr/bin/perl` at run time — it is never concatenated and
never runs under `osascript`.

### Build

`test/harness.js` and `test/*.test.js` concatenate the same way `src/` does, into `build/test.js`,
and run over `PURE` — the union of `CORE_PURE` and `FEATURE_PURE` — under `osascript`: a feature's
pure logic is unit-tested and coverage-measured exactly like core's, only its reachability from
core differs. `test/fake-mediaremote.js` and `test/fake-artwork.js` stand in for their
`src/system/` counterparts, so `make test` never touches perl or a real player either.
`CORE`/`FEATURES`/`CORE_PURE`/`FEATURE_PURE` are spelled out in the `Makefile`, with `PURE :=
$(CORE_PURE) $(FEATURE_PURE)` and `SOURCES := $(CORE) $(FEATURES)`: a new file is not built or run
until it is added to the right one. `scripts/globals.js` reads them back with `make print-<VAR>`
rather than re-parsing the `Makefile` text, since `SOURCES` is itself built from other variables;
`make globals` then writes what it computes into `biome.json`.

### Testing

- `make test-live` opens VLC on five minutes of generated silence, pauses it and walks the
  playback cases; it refuses to start while something is playing and stops the moment Now Playing
  goes to another app. Whatever it does not cover stays in the hand checklist below. Its last case
  hands Now Playing to QuickTime during a hold on VLC.
- `make test-world` checks the beliefs about other software that the code and the docs rest on,
  against that software: VLC, QuickTime Player, macOS's gate, Homebrew, nowplaying-cli. A belief
  found on a player belongs there, with the sentence it supports; `CHANGED` names what to revisit.
- `make test` cannot reach a real player: the argument cases and `test/fake.test.sh` run a build
  in which `src/system/mediaremote.js` is replaced by `test/fake-mediaremote.js` — a player that
  is a file, whose log says what it was told. It can obey, ignore, or be absent, which VLC cannot.
  A mutation run found 18 regressions of argument checks that would otherwise have driven the
  owner's film. The same style of run against `src/logic/` alone caught 73.6 % of breakages, next
  to the 100 % line coverage `make coverage` reports — a reached line is not a protected one.
- `make test` needs nothing playing. `test/cli.test.sh` runs each case under its own
  `XDG_CONFIG_HOME` (`NSHomeDirectory` ignores `HOME`) and covers exit 0, 64 and 78, and exit 1 of
  the refusals; exit 1 for nothing playing and exit 2 depend on the player and are in the live
  suite.
- Anything touching playback is checked by hand with a player running — look at `playing` first
  and never on something the owner is watching; note the position and put it back: `seek`, a held
  hotkey (five `forward` 30 ms apart must give +50 s), `toggle` twice, `backward` at 0, a hold
  (`forward 10 --hold &`, `release` 1.2 s later must give +60 s; `release` 80 ms later, +10 s;
  with `[hold] max_time = 1` and no `release` it must return by itself), a progressive hold
  (`forward --hold --progressive`, `release` 3 s later: about +88 s and the line ends with
  `×0.8`), a knob (five `forward --knob` 0.5 s apart: about +10 s; ten 50 ms apart: about +48 s),
  and `seek` past the end. Do `seek` past the end last and on something disposable: it ends the
  item, and a page with autoplay loads the next one in its place.
- A change to the tests is proven by breaking the code once and watching them fail.

### Response time

The tool is bound to a hotkey, so startup latency is the product; `test/speed.test.sh`'s budgets
came from these, measured on the owner's M1 Max, macOS 26.6, 2026-09-20:

- The real build, `/usr/bin/time -p`, 3 runs each: `status --json` 0.08 s, `artwork <path>` 0.08 s,
  `get` 0.08 s, `get --no-artwork` 0.06 s.
- `make test-speed` against `build/nowplayingseek-fake`, 21 runs each, median: `--help` 63 ms,
  `status --json` 89 ms, `status` 71 ms, `get` 73 ms, `get --no-artwork` 69 ms, `artwork <path>`
  67 ms, `forward 5` 108 ms. The fake build runs a touch slower than the real one above — no perl,
  same JXA startup — so the script's own budgets sit at roughly 3x these, not the real-build numbers.

A machine or a macOS upgrade moves every number here at once; re-run `make test-speed` and update
both this section and the budgets in the script together, or a budget from 2026 keeps guarding
against a machine that no longer exists.

Layout, gates, rules and settled decisions: [AGENTS.md](../AGENTS.md); the reasoning behind each
decision and the dead ends behind it: [how-it-works.md](how-it-works.md). What is left:
[BACKLOG.md](../BACKLOG.md). What changed: [CHANGELOG.md](../CHANGELOG.md).
