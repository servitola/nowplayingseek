# Changelog

What changed for someone who uses the tool. `scripts/release.sh bump` turns `Unreleased` into a
version, so keep that heading as it is.

## Unreleased

### Added
- `forward` / `backward --hold` and `release`: a hotkey's key down starts seeking, its key up stops
  it. For hotkey tools that run a command once per press and do not repeat it while the key is
  held — Karabiner-Elements is one. `[hold] interval` and `max_time` set the pace and the fuse.

### Changed
- `--progressive` grows smoothly by default: every step is a little longer than the last, a tap
  and the first second stay precise, and it settles at ×3 (`pattern = smooth`, `max_multiplier`,
  the new `ramp`). The staircase `5s:x2, 10s:x3, ...` lurched at every jump and ran up to ×10.
  A ladder written in the config file works as before, but `max_multiplier` now defaults to 3.

### Fixed
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
