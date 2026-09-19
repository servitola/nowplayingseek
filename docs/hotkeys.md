# Hotkeys, knobs and pedals

[← README](../README.md)

The tool does not grab keys itself; bind it with whatever you already use. Give the
full path — hotkey daemons run commands with a bare environment.

## A key, in Karabiner-Elements

<p align="center"><img src="images/banner-hotkeys.webp" alt="The panda presses one glowing fast-forward key; a thread of light runs to a glass player where the film blurs forward" width="100%"></p>

[Karabiner-Elements](https://karabiner-elements.pqrs.org/) is a free keyboard customiser for
macOS. ⌃⌥→ and ⌃⌥←: Karabiner runs a `shell_command` once per press and does not
repeat it while the key is held, so the key down starts a [`--hold`](advanced.md#hold) and the
key up ends it:

```json
{
  "description": "nowplayingseek ±10 s, hold to keep going",
  "manipulators": [
    { "type": "basic",
      "from": { "key_code": "right_arrow", "modifiers": { "mandatory": ["left_control", "left_option"] } },
      "to": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek forward --hold --progressive" }],
      "to_after_key_up": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek release forward" }] },
    { "type": "basic",
      "from": { "key_code": "left_arrow", "modifiers": { "mandatory": ["left_control", "left_option"] } },
      "to": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek backward --hold --progressive" }],
      "to_after_key_up": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek release backward" }] }
  ]
}
```

A tap is one step. Held, the key glides off in small steps, five a second, and with
`--progressive` they grow — see [the curve](advanced.md#progressive-seek). The pace, the step and
how it grows are in the [config file](advanced.md#config-file).

## A knob, in Karabiner-Elements

<p align="center"><img src="images/banner-knob.webp" alt="The panda turns the big knob of a glass keyboard; the handle of the progress bar above slides along" width="100%"></p>

If you have a mechanical keyboard with a knob, it is a jog wheel. A knob is two keys to the system, one per direction — volume up and down out of the
box. Reassign them in the keyboard's firmware (VIA, QMK, the vendor's app) to keys you do not
use, such as F13 and F14, and give those to `--knob`:

```json
{
  "description": "nowplayingseek: the keyboard knob is a jog wheel",
  "manipulators": [
    { "type": "basic", "from": { "key_code": "f14" },
      "to": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek forward --knob" }] },
    { "type": "basic", "from": { "key_code": "f13" },
      "to": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek backward --knob" }] }
  ]
}
```

Every click of the knob is one run of the command, and the tool reads the pace of the clicks: a
slow click is 2 s, fine enough to find a word; a flick makes every click up to four times
longer. The step, the limit and what counts as fast are `[knob]` in the
[config file](advanced.md#config-file).

## Other tools

Without third-party software, the Shortcuts app: **+** → the action **Run Shell Script** →
`/opt/homebrew/bin/nowplayingseek forward 30` → **ⓘ** → **Add Keyboard Shortcut**. The first run
asks for Settings → Advanced → **Allow Running Scripts**. The full path matters: Shortcuts runs a
script with a bare `PATH`. It tells a press, not a release, so `--hold` is not for it; give the
step you want in the command. The same shortcut can sit in the menu bar or answer to Siri.

Hammerspoon, in `~/.hammerspoon/init.lua`:

```lua
local function run(...)
  local arguments = { ... }
  return function() hs.task.new("/opt/homebrew/bin/nowplayingseek", nil, arguments):start() end
end
hs.hotkey.bind({ "ctrl", "alt" }, "right", run("forward", "--hold", "--progressive"), run("release", "forward"))
hs.hotkey.bind({ "ctrl", "alt" }, "left", run("backward", "--hold", "--progressive"), run("release", "backward"))
```

skhd, in `~/.config/skhd/skhdrc`:

```
ctrl + alt - right : /opt/homebrew/bin/nowplayingseek forward 10
ctrl + alt - left  : /opt/homebrew/bin/nowplayingseek backward 10
```

BetterTouchTool, Keyboard Maestro, a Raycast script command, a Stream Deck button — anything
that can run a shell command takes the same line. A USB foot pedal is a key like any other:
bind it and you have a transcription pedal for every player.
