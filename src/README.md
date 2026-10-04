# Source

Start with [`cli.js`](cli.js). `COMMANDS` there holds every command the tool has, and `run(argv)`
is what `osascript` calls. Pick a command and follow it into `core/`.

```
cli.js       every command, and run(argv)
core/        reading Now Playing and moving it: all a hotkey needs
features/    optional: config authoring, other tools' words, watch
```

JXA has no modules. `make` joins the files into one script, in the order of `CORE` and `FEATURES`
in the [`Makefile`](../Makefile), so a file sees only the names declared in the files before it.
A new file is not built until it is in one of those lists; `make globals` then tells the linter
which names cross files.

## core/

```
logic/     pure functions, no macOS: every one has a unit test
    time.js     parse and print a time; exit codes; Failure
    seek.js     where a step starts, whether it landed
    hold.js     a held key, the --progressive curve, the pace of a knob
    config.js   SETTINGS, and reading config.ini
    item.js  stream.js  text.js  paint.js    shaping and painting an answer
system/    the only place with $ and ObjC
    mediaremote.js   read Now Playing, send a command
    artwork.js  files.js  terminal.js  configfile.js  paths.js
player.js  player-commands.js  player-artwork.js
           a step, a hold, a command: logic wired to system
status.js  native-get.js
           the JSON of status, stream and get
args.js    a time, the flags of forward and backward, unknown arguments
output.js  how a command answers: a line, --json, --minify, --raw
usage.js   the help page
```

## features/

A feature is what core never calls. Core declares the extension points in `cli.js` — `COMMANDS`,
`dialectRouter`, `RENDERERS` — and a feature registers into one at the bottom of its own file.
`make lint` fails when a core file uses a name declared only under `features/`.

```
config/     config init, config set: writing config.ini
dialects/   the words of nowplaying-cli, media-control, playerctl, mpc, shpotify
watch/      the live terminal view of watch and stream
```

## Adding a setting

A number a user may change in `config.ini`.

1. One entry in `SETTINGS` in `core/logic/config.js`: the default, what it is about, what it
   expects. `config`, `config init`, `config set` and the unknown-key warning all read that table.
2. Use it as `player.settings.<section>.<key>`.
3. A case in `test/config.test.js`; a line in [docs/advanced.md](../docs/advanced.md) if a user
   should know of it.

## Adding a flag to forward and backward

1. `core/args.js`: name the flag, add it to `SEEK_FLAGS`, hand it on in `seekCommand`.
2. What the flag decides goes into `core/logic/` as a pure function with a unit test.
   `core/player.js` only wires reads, calls and waiting around it.
3. A line in `core/usage.js`, at most 80 columns.
4. A case in `test/cli.test.sh` for the arguments, one in `test/fake.test.sh` for what the player
   is told.

## Adding a command

One entry in `COMMANDS` in `cli.js`, and `make test` names what is still missing.

```js
skip: {
    answers: true,
    takes: ['intro', 'credits'],
    run(args, name, output) {
        …
    },
},
```

| Key | What it says |
| :-- | :-- |
| `run(args, name, output)` | the command itself; `output` is how it was asked to answer |
| `answers` | it takes `--json`, `--minify` and `--raw`, and answers through `show` or `showJson` |
| `takes` | the words it accepts; with none listed it accepts no arguments |
| `checksOwnArguments` | it reads a time or a path, so it refuses what it does not know itself |
| `offline` | it works with nothing playing: Now Playing is not loaded for it |
| `hidden` | it is left off the help page on purpose |

`test/commands.test.sh` walks the table and fails until the command is whole: only these keys, a
line on the help page (`core/usage.js`, at most 80 columns), a case that runs it, and a refusal
of an argument it does not take.

A command a hotkey never needs is a feature: its own folder under `features/`, its files in
`FEATURES`, and `COMMANDS.<name> = { … }` at the bottom of its file.

## Keeping it working

| | |
| :-- | :-- |
| `make lint` | style, the core and features boundary, names that cross files |
| `make test` | unit tests of the logic, the command table, then every command against a player that is a file |
| `make coverage` | lines of logic no unit test reaches |
| `make test-live` | the built tool against a real player |

Prove a new test by breaking the code once and watching it fail. Anything a user can see goes
under `Unreleased` in [CHANGELOG.md](../CHANGELOG.md). The rules, and why each is there:
[docs/development.md](../docs/development.md#rules).
