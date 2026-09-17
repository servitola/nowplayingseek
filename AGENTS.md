# nowplayingseek — agent rules

A command-line tool that reads and drives whatever macOS elected as Now Playing; people bind it
to hotkeys and call it from scripts, the owner holds a key to scrub through long videos.
`README.md` is the front door and `docs/` is the manual. Read `docs/how-it-works.md` before
touching `src/system/mediaremote.js` or `src/player.js` — each bullet there was a bug first. The README
stays under 100 lines: a new recipe, question or explanation goes into `docs/` and gets at most
a link. What is unfinished or undecided is in `BACKLOG.md`; this file holds only what stays true.

## Stack and layout

JavaScript for Automation under `/usr/bin/osascript`: no dependencies, no `package.json`, no
modules — except artwork, one compiled helper loaded into `/usr/bin/perl`, never `osascript`; see
`docs/how-it-works.md#artwork` before touching `native/artwork.m` or `src/system/artwork.js`.
`make` concatenates the JS sources into one executable script, so a symbol declared in one file is
a plain global in the files after it.

Opening `src/` should show, at once, that this is a command-line tool for seeking through what is
playing and reading its state — a small flat core — with everything else a reader can decide not
to look at under `src/features/`. **The rule that decides core vs. feature, always: a feature is
something core never calls.** If core calls it, it is core, whatever a file's folder or name
suggests — a folder is where a file happens to live, not what makes it a feature. Core declares an
extension point (`COMMANDS`, `dialectRouter`, `RENDERERS`) and a feature registers into it at its
own file's bottom; core never names a feature file. `scripts/globals.js --check` enforces this
mechanically: it fails `make lint` if a `CORE`-listed file mentions a symbol declared only under a
`FEATURES`-listed one — a build check, not a promise kept by discipline. Violate it and `make
lint` names the file and the symbol; the fix is almost always the one this migration made three
times over — pull the piece core actually needs out into a core file, and leave the rest optional:

```
src/logic/      knows nothing of macOS — every function here has a unit test
    time.js         parse and print a time; exit codes; Failure
    seek.js         where a step starts, whether it landed, whether an older seek overtook it
    hold.js         a held key and its release; the --progressive curve; the pace of a knob
    stream.js       what changed between two reads — status.js's own stream diffs with this too
    item.js         the order of --raw; the chapter as 6/13; the `human` block
    text.js         fitting a line to the terminal width; stripping paint to measure it
    paint.js        what a terminal gets: the status line, the help page, JSON, ini — bold, dim and the sixteen colours, each with a meaning
    config.js       the SETTINGS table; reading and resolving an ini — read on every command;
                    authoring one (config init, config set) is a feature, see src/features/config/
src/system/     the only place with $ and ObjC
    mediaremote.js  read Now Playing, send commands — the private framework lives here alone
    artwork.js      shells out to /usr/bin/perl for the one thing osascript cannot read
    files.js        the temp files processes talk through, and the lock
    terminal.js     is stdout a terminal; an app's name from its bundle id
    configfile.js   find, load config.ini — read only; writing one is a feature
src/player.js   a step, a hold, waiting for the player — ties logic to system
src/player-commands.js   requireState, requirePosition, send — simple dispatch to mediaRemote
src/player-artwork.js    the artwork() primitive, fetched through system/artwork.js
src/status.js   status.get()/status.stream(): the JSON payload of media-control's own `get` and
                `stream`, and mediaControlSeek(), its own seek — the native `status --json`,
                `stream`, `seek --micros` and the hidden `get` all reach these, so this dialect's
                own vocabulary stays core even though speaking it as a dialect is a feature.
                `stream` paints in a terminal only if RENDERERS.watch is set, else the plain JSON
                it always emits for a pipe
src/native-get.js   nowplaying-cli's own shape for `get`/`get-raw` — the same story as status.js,
                for the other dialect two native commands are secretly implemented by
src/output.js   how a command answers: a line, `--json`, `--minify`, `--raw` — one contract for all of them
src/args.js     what a command may take: SPEAKING, FLAGS, seekCommand — cli.js is dispatch alone
src/cli.js      our own commands, `run(argv)` — the entry point `osascript` calls; declares
                COMMANDS, dialectRouter and RENDERERS, the extension points features register into
src/usage.js    the help page; after cli.js, because it names the version
src/features/config/   authoring config.ini — init, set, the template
    settings-authoring.js   formatSettings, the template, config-set parsing, rewriting a line of ini
    configfile.js           Object.assign(configFile, {init, set, write})
    command.js               COMMANDS.config = (...), self-registered
src/features/dialects/   one file a tool; they call player, system, status and native-get, never
                each other's insides, and never the reverse
    words.js                 the seek words of playerctl and mpc; playerctl's format strings
    nowplaying-cli.js   media-control.js (+ -help.js)   playerctl.js   mpc.js
    shpotify.js   shared.js (refuse, unknown, move, stop)
    index.js                 DIALECTS (which first word is which tool); dialectRouter.current =
                              dialectFor, the one line that hands core its hook into this folder
src/features/watch/   the live, painted terminal rendering of `watch` and of `stream`
    change.js                 what happened between two reads, in a word — describeChange, logOf
    loop.js                   the `watching` object (was src/watch.js); sets RENDERERS.watch and,
                              through it, COMMANDS.watch — core never names `watching` itself
```

`native/artwork.m` sits outside that list: clang builds it into `build/nowplayingseek-artwork.bundle`,
which `src/system/artwork.js` loads into `/usr/bin/perl` at run time — it is never concatenated and
never runs under `osascript`.

`test/harness.js` and `test/*.test.js` are concatenated the same way into `build/test.js` and run
over the pure logic of both core and features (`PURE`, the union of `CORE_PURE` and
`FEATURE_PURE` — a feature's pure logic is unit-tested and coverage-measured exactly like core's,
only its reachability from core that differs); `test/cli.test.sh` drives the built tool without a
player; `test/live.test.sh` drives VLC. `test/fake-mediaremote.js` and `test/fake-artwork.js` stand
in for their `src/system/` counterparts the same way, so `make test` never touches perl either. The
lists are spelled out in the `Makefile`, as `CORE`/`FEATURES` (and `CORE_PURE`/`FEATURE_PURE`, the
pure subsets of each) with `PURE := $(CORE_PURE) $(FEATURE_PURE)` and `SOURCES := $(CORE)
$(FEATURES)`: a new file is not built or run until it is added to the right one. `scripts/globals.js`
reads them back with `make print-<VAR>` rather than re-parsing the Makefile text, since `SOURCES`
is itself built from other variables now; `make globals` then writes what it computes into
`biome.json`.

## Commands and gates

`make build`, `make test` (prints `N passed` and `N cli cases passed`), `make lint` (every hook on
every tracked file; needs `pre-commit`), `make install PREFIX=~/.local`. `build` and `test` also
compile `native/artwork.m`, so they need `clang` (Xcode Command Line Tools; every Homebrew machine
already has it). `pre-commit install` once after cloning; commits go through the hook, `--no-verify`
and `SKIP=` are not used here. Run one `pre-commit` at a time: it stashes unstaged changes while it
works, and a second run in the same tree fails with "files were modified by this hook".

- Biome with every stable rule as an error, plus its formatter; actionlint; shellcheck and shfmt.
  Versions are pinned in `.pre-commit-config.yaml`.
- What is switched off, and why a symbol from another file is not "undeclared", is in `biome.json`
  → `overrides`: a symbol used across files goes into the group's `globals`, one a file
  declares for others into `noUnusedVariables.ignore`. Both lists are written by `make globals`
  (`scripts/globals.js`, from the `Makefile` lists and the top-level declarations); `make lint`
  refuses when they are behind the sources. `src/logic/` gets no `$` and no `ObjC`. A rule goes off
  only when it cannot hold for JXA — say why in the commit.
- `make coverage`: which lines of `src/logic/` the unit tests never reach, counted by V8 under
  node, no dependency. It is 100 %, and that says little: a mutation run caught 73.6 % of breakages
  in the same code. A reached line is not a protected one. `make typecheck`: TypeScript's checker
  over the built file, not strict — a wrong name, a wrong count of arguments, a property nothing
  has. Both are for development; CI runs neither.
- `make test-speed`: the tool is bound to a hotkey, so its own startup time is the product —
  `test/speed.test.sh` runs each of `--help`, `status`, `get` and `forward` 21 times against
  `build/nowplayingseek-fake` and fails when the median goes past a budget (~3x a baseline measured
  on the owner's M1 Max, `docs/development.md#response-time`). Not part of `make test`: timing is
  noise on a shared, loaded CI runner, signal only on a quiet machine.
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
- `make test-world` checks the beliefs about other software that the code and the docs rest on,
  against that software: VLC, QuickTime Player, macOS's gate, Homebrew, nowplaying-cli. A belief
  found on a player belongs there, with the sentence it supports; `CHANGED` names what to revisit.
  The live suite's last case hands Now Playing to QuickTime during a hold on VLC.
- `make test` cannot reach a real player: the argument cases and `test/fake.test.sh` run a build in
  which `src/system/mediaremote.js` is replaced by `test/fake-mediaremote.js` — a player that is a
  file, whose log says what it was told. It can obey, ignore, or be absent, which VLC cannot. A
  mutation run found 18 regressions of argument checks that would otherwise have driven the owner's
  film.
- `make test` needs nothing playing. `test/cli.test.sh` runs each case under its own
  `XDG_CONFIG_HOME` (`NSHomeDirectory` ignores `HOME`) and covers exit 0, 64 and 78, and exit 1 of
  the refusals; exit 1 for nothing playing and exit 2 depend on the player and are in the live suite.
- Anything touching playback is checked by hand with a player running — look at `playing` first and
  never on something the owner is watching; note the position and put it back: `seek`, a held hotkey
  (five `forward` 30 ms apart must give +50 s), `toggle` twice, `backward` at 0, a hold (`forward 10
  --hold &`, `release` 1.2 s later must give +60 s; `release` 80 ms later, +10 s; with `[hold]
  max_time = 1` and no `release` it must return by itself), a progressive hold (`forward --hold
  --progressive`, `release` 3 s later: about +88 s and the line ends with `×0.8`), a knob (five
  `forward --knob` 0.5 s apart: about +10 s; ten 50 ms apart: about +48 s), and `seek` past the
  end. Do `seek` past the end last and on something disposable: it ends the item, and a page with
  autoplay loads the next one in its place.
- A change to the tests is proven by breaking the code once and watching them fail.

## The demo picture

`docs/images/demo.svg` in the README is drawn by the real painters over sample data. When the painted
output changes, run the owner's `~/projects/serho_topics/аудио-управлятор/outreach/demo.sh` and
commit the result; a picture that shows yesterday's output is a false claim.

## The banners

`docs/images/banner*.webp`: one panda, one sunset, one scene per page. 1600×800, WebP q85, no text in the
picture — image models misspell it, the heading says it. They are drawn by fal.ai
`openai/gpt-image-2.5/sunburst/edit` with `docs/images/banner.webp` as the reference image, which is what
keeps the panda the same; FLUX Kontext will not change its pose. The scenes are in the owner's
`~/projects/serho_topics/аудио-управлятор/banner-series/gen.py`. A scene must show the action: the
paw on the knob, the finger on the key.

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
- **Chapters.** `MRMediaRemoteCommandNextChapter` / `PreviousChapter` (100, 101) are delivered and IINA
  ignores them: it registers no chapter handler with the system. `ChapterNumber` and
  `TotalChapterCount` can be read; chapter times cannot. Moving by chapter needs a driver for the
  player, which the owner has ruled out.
- **A helper dylib inside `osascript`.** Refused: "mapping process is a platform binary, but
  mapped file is not". perl, ruby and python load a plain arm64 one; it is `osascript` that wants arm64e.

The tool therefore drives the elected app and only that. This is a decision, not a gap.
