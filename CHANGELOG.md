# Changelog

What changed for someone who uses the tool. `scripts/release.sh bump` turns `Unreleased` into a
version, so keep that heading as it is.

## Unreleased

### Changed
- `config init` writes every key commented out. A file of live defaults kept its owner on the
  numbers of the day it was written: the fuse stayed at 10 s on the very machine it was raised on.
- What a person reads next to a value — a clock, the app's name, the local time — is one `human`
  object at the end of `status --json` and `--raw`, in a pipe as well. Written after the values in a
  terminal, as it briefly was, it made the copied text invalid JSON.
- A hold goes on for a minute before it ends by itself, not ten seconds (`[hold] max_time`). Ten
  seconds cut a long seek short and made the hand start over from a slow step. The fuse is for a
  release that never arrives, and that can no longer be lost on the way — it has a file of its own
  — so the worst a stuck key does is reach the end of the item, where a step stops 5 s short.
- `status --raw` puts first what one looks for first — title, length, position, chapter — and folds
  the four artwork keys into one `Artwork` object at the end.

### Fixed
- `stream --debounce` held back a play or a pause as well; media-control reports those at once.
- A step waiting to see itself land could send its target again to an app elected in the meantime:
  seen once in three tries, a second player thrown 10 s back while a hold on the first was ending.
  The wait now ends when the elected app changes, and a re-send never crosses apps.
- `status --raw` wrote a file's URL as `{}`.

### Added
- `watch`: stays, and shows where the item is, redrawn once a second, with a line for whatever
  happens to it — played, paused, seeked to, a new item, nothing playing. The line is redrawn with a
  carriage return and nothing else, because `osascript` cannot catch Ctrl-C to tidy a terminal up;
  a long title is cut to the terminal's width. `[watch] interval` sets the pace.
- `stream` in a terminal shows the same events in words instead of raw JSON. A pipe gets the
  media-control protocol byte for byte, as before.
- `make test-world`: what the project believes about software it does not own, checked against it —
  that a binary of our own reads nothing of Now Playing and one signed `com.apple.*` does, that VLC
  reports a rate of 1 while paused and keeps whole seconds, that QuickTime does neither, that
  nowplaying-cli reads the position as 0, that Homebrew trusts a formula named in full. When one
  stops holding it says which workaround or sentence it made obsolete.
- In a terminal everything is painted for the eye: the help page in sections with the commands in
  one colour and their arguments dim, `status --json` and `--raw` indented with keys, numbers and
  nulls told apart, `config` with its comments dim, an error with its first word in red. A pipe
  gets exactly what it got before.
- In a terminal the status line is painted: the position bold, the length dim, a bar of where you
  are, the title bold, the chapter when the player tells it (`ch 6/13`), the app by its name — `· IINA`, not `(com.colliderli.iina)`. A pipe gets the
  line it always got, and `NO_COLOR` or `TERM=dumb` switch the paint off.
- `nps`, a short name for the same tool: `nps forward`, `nps status`. Free in Homebrew; an npm
  package of that name exists, and whichever comes first in `PATH` wins.

## 0.5.0 — 2026-09-19

### Added
- The command lines of the tools people used before are understood, so that moving over is a change
  of one word: nowplaying-cli (`get`, `get --json`, `get-raw`, `togglePlayPause`) and media-control
  (`get`, `stream`, its fourteen commands, `send`, `shuffle`, `repeat`, `speed`) directly; playerctl,
  mpc and shpotify behind their names — `nowplayingseek playerctl position 30+`. What is and is
  not supported: docs/migrating.md.
- `make test-live`: the live checklist as a script — VLC on generated silence, paused, 72 cases.
- `status --raw`: every key macOS holds for the item, as JSON — chapters, media type, the size of
  the artwork, the file's URL where the player gives one.

### Changed
- The knob is gentler: 2 s a click, up to ×4, and `fast = 18` clicks a second — reasoned from encoder
  datasheets and keyboard firmware, where a quick turn is 8–15 clicks a second and a flick 20–40.
  With the old numbers one quick rotation crossed three and a half minutes.
- `forward`, a hold and the knob stop 5 s short of the end: landing on the very end finished the
  item, and a page with autoplay loaded the next one. `seek <time>` stays exact.
- A hold ends by itself after 10 s, not 30 (`[hold] max_time`): that is ten minutes of film, and a
  release that never arrives costs that much less.

### Fixed
- `seek` to the position the player is already at exited 2 on a paused web page; it exits 0.
- Presses 30 ms apart — key repeat, a knob — lost one press in two runs out of three: separate
  processes read the same last seek, took a refresh meant for an older seek as their own, and the
  player received the seeks out of order. A lock, a stricter reading of a refresh, and a re-send
  by the newest process: five presses are +50 s in twenty runs out of twenty.
- A hold stops when another app becomes Now Playing, instead of sending it the old app's targets.
- `pause`, `toggle`, `play`, `next`, `previous` exit 1 when nothing is playing; they exited 0.
- `forward 0` is refused (exit 64); with `--hold` it was a stack trace.
- A player that reports no playback rate while playing no longer has its position stand still.
- Rolling from one held key to the other: letting go of the first stopped the second. `release`
  now takes a direction — `release forward`, `release backward` — and the recipes pass it; a bare
  `release` still stops both.
- VLC keeps `PlaybackRate` at 1 while paused, so `status` showed it playing with a position that
  ran ahead, and `pause` / `toggle` paused it and then exited 2. The play state now comes from
  macOS's own flag, not from the rate.

## 0.4.0 — 2026-09-19

### Added
- `forward` / `backward --hold` and `release`: a hotkey's key down starts seeking, its key up stops
  it. For hotkey tools that run a command once per press and do not repeat it while the key is
  held — Karabiner-Elements is one. `[hold] interval` and `max_time` set the pace and the fuse.
- `forward` / `backward --knob`: one click of a keyboard knob. The faster the knob spins, the
  longer the step — 3 s a click when turned slowly, up to five times that on a flick; `[knob]` in
  the config file. With a Karabiner-Elements rule in docs/hotkeys.md. The numbers are a starting
  point: they were checked with simulated clicks, not yet tuned on a real knob.

### Changed
- `--progressive` grows smoothly: a press is one whole step, a held key then glides off in small
  steps, every one a little longer than the last, and settles at ×2.5 — `start`, `max_multiplier`
  and `ramp` in the config file. The staircase lurched at every jump and ran up to ×10.
- `backward` at the very start and `forward` at the very end do nothing and exit 0 instead of
  asking the player for a seek to where it already is.

### Removed
- The `pattern` ladder of 0.3.0. A config file that has a `pattern` line is now refused with its
  line number: delete the line.

### Fixed
- A step made within 3 s of a step in another app started from that app's position: the target a
  held key builds on is now tied to the app it was made in.
- The Karabiner-Elements recipe never repeated while the key was held, so `--progressive` had
  nothing to grow on. The recipe now uses `--hold`.

## 0.3.0 — 2026-09-18

### Added
- `forward` / `backward --progressive`: the step grows the longer the key is held, by a
  user-written ladder such as `5s:x2, 10s:x3, ...`.
- Config file `~/.config/nowplayingseek/config.ini` (`$XDG_CONFIG_HOME` is honoured) for the default
  step, the progressive ladder and the timing constants; `config` prints what is in effect,
  `config init` writes the defaults. A bad config is exit code 78 with the line number.

### Changed
- Arguments a command does not know are exit 64 instead of being ignored: `status --jsno`,
  `pause 10`, `seek 10 20`, `config init --force`.

## 0.2.0 — 2026-09-18

### Changed
- Commands have full names only: `forward`, `backward`, `previous` replace `fwd`, `back`, `prev`.

## 0.1.0 — 2026-09-18

First release: `status`, `position`, `duration`, `seek`, relative seek, `toggle`, `play`, `pause`,
`next`, `prev`, `doctor` for whatever macOS elected as Now Playing.
