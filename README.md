<p align="center"><img src="docs/banner.webp" alt="A panda in headphones drags the scrubber of a glass Now Playing widget, a waveform glowing behind it" width="100%"></p>

# nowplayingseek

Skip 10 seconds back or forward in whatever is playing on your Mac — a YouTube tab, IINA,
Music, Spotify, a podcast — from a global hotkey or a keyboard knob, whichever app has the
focus. macOS has no such key; this is the command to put behind one.

```console
$ nowplayingseek status
▶ 30:57 / 3:15:50  UFC Fight Night 287  (com.colliderli.iina)
$ nowplayingseek backward 10
▶ 30:47 / 3:15:50  UFC Fight Night 287  (com.colliderli.iina)
$ nowplayingseek seek 12:34
▶ 12:34 / 3:15:50  UFC Fight Night 287  (com.colliderli.iina)
```

## Install

```sh
brew install servitola/tap/nowplayingseek
```

No dependencies: it is a script for `osascript`, which ships with macOS.

## Bind it to keys

Shortcuts.app → new shortcut → "Run Shell Script" → `/opt/homebrew/bin/nowplayingseek forward 10`
→ ⓘ → "Add Keyboard Shortcut". The same line works in Karabiner-Elements, Hammerspoon, skhd,
BetterTouchTool, Raycast — ready-made snippets are in [docs/hotkeys.md](docs/hotkeys.md).

A rotary knob on the keyboard becomes a jog wheel: bind its two directions to `forward` and
`backward`, add `--progressive`, and a fast spin scrubs further than a slow one.

## Commands

| Command | |
| --- | --- |
| `status [--json]` | title, app, position / duration |
| `position`, `duration` | seconds |
| `seek <time>` | jump to `754`, `12:34` or `1:02:03` |
| `forward [time]`, `backward [time]` | seek by a step, 10 s by default |
| `toggle`, `play`, `pause`, `next`, `previous` | transport |
| `doctor` | exit 0 when Now Playing is readable |

Every command waits until the player has done what was asked: exit `0` means it happened,
`1` nothing is playing, `2` the player ignored it.

## Good to know

- It drives the app macOS elected as Now Playing, the one in the Control Center widget. If
  that is not the one you mean, press play there.
- A web page has to support seeking: YouTube does, a page without a MediaSession handler
  gives exit 2.
- It rests on a private API that Apple can close in any update. Tested on macOS 26.6.

## More

- [Hotkeys, knobs and pedals](docs/hotkeys.md) — Karabiner-Elements, Hammerspoon, skhd, a foot pedal
- [Advanced](docs/advanced.md) — a step that grows while the key is held, the config file
- [For scripts and AI agents](docs/scripting.md) — JSON, exit codes, what to run for what
- [Compared with](docs/compared.md) nowplaying-cli, media-control and a player's own keys
- [How it works](docs/how-it-works.md) — why it is a script and not a binary, and the limits in full
- [Questions](docs/questions.md)

## Development

`make build`, `make test` (needs nothing playing), `make lint` (needs `pre-commit`),
`make install PREFIX=~/.local`. The layout,
the rules and the dead ends are in [AGENTS.md](AGENTS.md); what is left to do is in
[BACKLOG.md](BACKLOG.md).

## Licence

[AGPL-3.0](LICENSE) © [servitola](https://github.com/servitola). For a commercial licence, open an issue.
