# Changelog

What changed for someone who uses the tool. `scripts/release.sh bump` turns `Unreleased` into a
version, so keep that heading as it is.

## Unreleased

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
