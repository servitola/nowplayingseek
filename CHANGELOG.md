# Changelog

What changed for someone who uses the tool. `scripts/release.sh bump` turns `Unreleased` into a
version, so keep that heading as it is.

## Unreleased

## 2026.07.31 — 2026-07-31

### Added
- `forward` / `backward --progressive`: the step grows the longer the key is held, by a
  user-written ladder such as `5s:x2, 10s:x3, ...`.
- Config file `~/.config/nowplayingseek/config.ini` (`$XDG_CONFIG_HOME` is honoured) for the default
  step, the progressive ladder and the timing constants; `config` prints what is in effect,
  `config init` writes the defaults. A bad config is exit code 78 with the line number.

### Changed
- Arguments a command does not know are exit 64 instead of being ignored: `status --jsno`,
  `pause 10`, `seek 10 20`, `config init --force`.

## 2026.07.21 — 2026-07-21

### Changed
- Commands have full names only: `forward`, `backward`, `previous` replace `fwd`, `back`, `prev`.

## 2026.07.20 — 2026-07-20

First release: `status`, `position`, `duration`, `seek`, relative seek, `toggle`, `play`, `pause`,
`next`, `prev`, `doctor` for whatever macOS elected as Now Playing.
