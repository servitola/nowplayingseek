# nowplayingseek

Control whatever macOS considers "now playing" — the thing in the Control Center media
widget, be it a browser tab, IINA, Music or Spotify — from the command line: read the
position, jump to an exact second, seek by a step, pause.

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

The system `fast_forward` / `rewind` media keys give you neither a position nor a step
of your choice. This does.

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

Without third-party software: Shortcuts.app → new shortcut → "Run Shell Script" →
`/opt/homebrew/bin/nowplayingseek forward 10` → ⓘ → "Add Keyboard Shortcut".

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

## Development

```sh
make test     # pure-function tests, no playback needed
make build    # build/nowplayingseek
```

`src/` is concatenated in dependency order because JXA has no modules: `core.js` (pure,
tested), `mediaremote.js` (the only file that touches the private framework),
`player.js` (seek and command verification), `cli.js`.

Copyright © 2026 Vladislav Konovalov. Free software under the [GNU AGPL 3.0](LICENSE): use it,
change it, pass it on under the same terms. To ship it inside a product that is not under a
compatible licence, write to servitola@gmail.com for a commercial one.
