<p align="center"><img src="docs/banner.webp" alt="A panda in headphones drags the scrubber of a glass Now Playing widget, a waveform glowing behind it" width="100%"></p>

# nowplayingseek

Skip 10 seconds back or forward in whatever is playing on your Mac — a YouTube tab, IINA,
Music, Spotify, a podcast — from a global hotkey, a keyboard knob or a script, whichever app
has the focus. It is a command-line tool for the thing in the Control Center media widget:
read the position, jump to an exact second, seek by any step, pause.

```console
$ nowplayingseek status
▶ 30:57 / 3:15:50  UFC Fight Night 287  (com.colliderli.iina)
$ nowplayingseek position
1857.479
$ nowplayingseek duration
11750.050
$ nowplayingseek seek 12:34
▶ 12:34 / 3:15:50  UFC Fight Night 287  (com.colliderli.iina)
$ nowplayingseek forward 60
▶ 13:34 / 3:15:50  UFC Fight Night 287  (com.colliderli.iina)
```

## Why

I wanted two keys on my keyboard: 10 seconds back and 10 seconds forward, for whatever
is playing, whichever app has the focus. macOS cannot do that. Its media keys cover
play/pause, next and previous; the `fast_forward` / `rewind` keys give you neither a
position nor a step of your choice; and a player's own arrow-key shortcuts work only
while its window is focused — and differ from player to player.

So this is a command that seeks the current item by exactly the step you ask for, and
any hotkey tool can call it — see [Hotkeys](#hotkeys).

It gets better if your keyboard has a rotary knob, as many mechanical ones do. Bind the
two directions of the knob to `forward` and `backward` and it becomes a jog wheel: turn it
to scrub through the video or the podcast, in any app, without reaching for the mouse.

## Install

```sh
brew install servitola/tap/nowplayingseek
```

or from a checkout: `make install PREFIX=~/.local`. No dependencies — it is a script
for `osascript`, which ships with macOS.

## Commands

| Command | |
| --- | --- |
| `status [--json]` | title, app, position / duration; JSON has seconds, `playing`, `rate`, bundle id |
| `position` | current position in seconds |
| `duration` | total length in seconds |
| `seek <time>` | jump to an exact position: `seek 754`, `seek 12:34`, `seek 1:02:03` |
| `forward [time]`, `backward [time]` | relative seek, 10 s by default |
| `toggle`, `play`, `pause`, `next`, `previous` | transport |
| `doctor` | exit 0 when Now Playing is readable |

Exit codes: `0` done, `1` nothing is playing, `2` the player did not react, `64` bad
arguments. Every command waits until the player has actually done what was asked, so
exit 0 means it happened.

## Hotkeys

The tool does not grab keys itself; bind it with whatever you already use. Give the
full path — hotkey daemons run commands with a bare environment.

Karabiner-Elements, ⌃⌥→ and ⌃⌥←:

```json
{
  "description": "nowplayingseek ±10 s",
  "manipulators": [
    { "type": "basic",
      "from": { "key_code": "right_arrow", "modifiers": { "mandatory": ["left_control", "left_option"] } },
      "to": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek forward 10" }] },
    { "type": "basic",
      "from": { "key_code": "left_arrow", "modifiers": { "mandatory": ["left_control", "left_option"] } },
      "to": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek backward 10" }] }
  ]
}
```

Holding the key works: steps add up even though key repeat is faster than Now Playing
refreshes.

A rotary knob is two keys to the system, one per direction — volume up and down out of
the box. Reassign them in the keyboard's firmware (VIA, QMK) to keys you do not use, such
as F13 and F14, and bind those the same way. Every click of the knob is one press, so with
[`--progressive`](#progressive-seek) a fast spin covers more ground than a slow one.

Without third-party software: Shortcuts.app → new shortcut → "Run Shell Script" →
`/opt/homebrew/bin/nowplayingseek forward 10` → ⓘ → "Add Keyboard Shortcut".

Hammerspoon, in `~/.hammerspoon/init.lua`:

```lua
local function seek(direction)
  return function()
    hs.task.new("/opt/homebrew/bin/nowplayingseek", nil, { direction, "10", "--progressive" }):start()
  end
end
hs.hotkey.bind({ "ctrl", "alt" }, "right", seek("forward"), nil, seek("forward"))
hs.hotkey.bind({ "ctrl", "alt" }, "left", seek("backward"), nil, seek("backward"))
```

skhd, in `~/.config/skhd/skhdrc`:

```
ctrl + alt - right : /opt/homebrew/bin/nowplayingseek forward 10
ctrl + alt - left  : /opt/homebrew/bin/nowplayingseek backward 10
```

BetterTouchTool, Keyboard Maestro, a Raycast script command, a Stream Deck button — anything
that can run a shell command takes the same line. A USB foot pedal is a key like any other:
bind it and you have a transcription pedal for every player.

## Compared with

| | nowplayingseek | [nowplaying-cli] | [media-control] | the player's own keys |
| --- | --- | --- | --- | --- |
| Seek by a step you choose | `forward 45`, `backward 5` | no, `seek` is absolute | fixed 15 s | fixed, differs per player |
| Works while another app has the focus | yes | yes | yes | no |
| Step grows while the key is held | `--progressive` | no | no | no |
| `12:34` as a time | yes | seconds only | seconds only | — |
| Track metadata, artwork, live stream of changes | title, artist, album | yes | yes, the most complete | — |
| Install | one script, personal tap | homebrew-core | homebrew-core | — |

If you need artwork or a stream of Now Playing updates for a status bar, take `media-control`.
This tool is for moving through what plays.

[nowplaying-cli]: https://github.com/kirtan-shah/nowplaying-cli
[media-control]: https://github.com/ungive/media-control

## How it works, and why it is a script

Since macOS 15.4 `mediaremoted` answers Now Playing *reads* only to processes whose
bundle identifier starts with `com.apple.`. Your own compiled binary gets an empty
dictionary and no error. `/usr/bin/osascript` qualifies, so the whole tool is JavaScript
for Automation that loads the private `MediaRemote.framework` inside it. That is the same
loophole [ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter)
uses through `/usr/bin/perl`, minus the helper framework and at about half the latency
(~60 ms per read). Rewriting this in Swift or Go would break it.

Three things the API does not tell you:

- `ElapsedTime` is a snapshot taken at `Timestamp`, not the position. The live position
  is `elapsed + rate × (now − timestamp)`.
- There is no relative seek. `forward` / `backward` read, add, and seek to an absolute time. Now
  Playing refreshes 50–150 ms after a seek — over a second when a page buffers — so
  consecutive presses build on the previous target until it catches up.
- `MRMediaRemoteSendCommand` returns `true` immediately and delivers asynchronously; a
  process that exits right away never sends the command. The tool polls for the effect.

## Limits

- It drives the app macOS elected as Now Playing — the one in the Control Center widget —
  and nothing else. macOS elects the app that *started playback most recently* and keeps it
  elected for minutes after it pauses, even while another app is audibly playing. So after
  a voice message in a messenger, the hotkeys drive the paused messenger, not the video you
  are watching. Press play in the app you mean and it is elected again.
- There is no way around that from outside. `MRMediaRemoteSendCommandToPlayer`,
  `…ToApp`, `…ToClient` and `MRNowPlayingRequest` all accept a target, and for an
  unentitled caller `mediaremoted` silently redirects every one of them to the elected
  app; only Apple's own Music is addressed as asked (measured on macOS 26.6).
- Seeking needs the player's cooperation. YouTube in Chromium browsers and IINA work. A
  web page without a MediaSession `seekto` handler swallows the call; you get exit 2.
- Private API. Tested on macOS 26.6 only. Apple can close this door in any update — run
  `nowplayingseek doctor` while something is playing to find out.

## Questions

**How do I skip forward 10 seconds on a Mac with a keyboard shortcut, in any app?** Install
the tool and bind `nowplayingseek forward 10` to a key — see [Hotkeys](#hotkeys). The key
works whichever app is in front, because it talks to Now Playing and not to a window.

**Is there a Mac hotkey to rewind 10 seconds?** Not built in. The media keys do play/pause,
next and previous; `nowplayingseek backward 10` on a hotkey is the missing one.

**Can the knob on my keyboard scrub a video?** Yes: remap its two directions to spare keys
in VIA or QMK, bind them to `forward` and `backward`, add `--progressive` so that a fast spin
goes further.

**Why does `MRMediaRemoteGetNowPlayingInfo` return nothing in my own program?** Since macOS
15.4 `mediaremoted` answers only processes whose bundle identifier starts with `com.apple.`.
Run the call inside one that qualifies — `/usr/bin/osascript` as here, or `/usr/bin/perl` as
[ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter) does.

**The hotkey moves the wrong player.** macOS elects one app as Now Playing, and that is the
one driven — see [Limits](#limits). Press play in the app you mean.

**Exit 2 on a web page.** The page has no MediaSession `seekto` handler; nothing outside the
browser can seek it.

## For scripts and AI agents

Every command is one line in, one line out, and the exit code is the truth: `0` it happened,
`1` nothing is playing, `2` the player ignored it, `64` bad arguments, `78` bad config.

| Asked | Run |
| --- | --- |
| what is playing, where am I, how much is left | `nowplayingseek status --json` — `position` and `duration` in seconds, `playing`, `app` |
| go back a minute | `nowplayingseek backward 60` |
| jump to 12:30 | `nowplayingseek seek 12:30` |
| pause, resume, next | `nowplayingseek pause`, `play`, `next` |
| can this Mac be driven at all | `nowplayingseek doctor` |

Only the elected app can be addressed. When `status` shows another player than the one the
person means, tell them to press play there; do not retry.

## Advanced

Nothing here is needed for everyday use.

### Progressive seek

With `--progressive` the step grows the longer the key is held: bind
`nowplayingseek forward --progressive` and a tap is still 10 s, while holding the key for
5 s makes every repeat worth 20 s, for 10 s — 30 s, and so on. Presses in one direction
no further apart than `streak_gap` count as one hold, so fast tapping accelerates too;
the other direction, a pause or a `seek` starts over. When the step was multiplied, the
output line ends with the multiplier: `×3`.

The ladder is the `pattern` setting — `<held seconds>:<multiplier>` points, `s` and `x`
optional:

| `pattern` | |
| --- | --- |
| `5s:x2, 10s:x3, ...` | the default; `...` continues at the pace of the last two points — `15s:x4`, `20s:x5` — up to `max_multiplier` |
| `2s:x2, ...` | one point continues from `0s:x1`: +1 every 2 s |
| `3s:x2, 6s:x5, 10s:x20` | no `...`: stays at ×20 |
| `1s:x1.5, 2s:x3, ...` | fractions work: +1.5 every second |

### Config file

`~/.config/nowplayingseek/config.ini` (`$XDG_CONFIG_HOME/nowplayingseek/config.ini` when
that is set). The file is optional and so is every key in it; `nowplayingseek config init`
writes one with the defaults and a comment per key, `nowplayingseek config` prints what
is in effect.

Comments are whole lines starting with `;` or `#`. An unknown section or key, or a value
that does not parse, stops every command with exit 78 and the line number — a typo never
silently falls back to a default.

## Development

`make build`, `make test` (needs nothing playing), `make lint` (needs `pre-commit`). The layout,
the rules and the dead ends are in [AGENTS.md](AGENTS.md); what is left to do is in
[BACKLOG.md](BACKLOG.md).

Copyright © 2026 Vladislav Konovalov. Free software under the [GNU AGPL 3.0](LICENSE): use it,
change it, pass it on under the same terms. To ship it inside a product that is not under a
compatible licence, write to servitola@gmail.com for a commercial one.
