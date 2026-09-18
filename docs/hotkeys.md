# Hotkeys, knobs and pedals

[← README](../README.md)

The tool does not grab keys itself; bind it with whatever you already use. Give the
full path — hotkey daemons run commands with a bare environment.

Karabiner-Elements, ⌃⌥→ and ⌃⌥←. Karabiner runs a `shell_command` once per press and does not
repeat it while the key is held, so the key down starts a [`--hold`](advanced.md#hold) and the
key up ends it:

```json
{
  "description": "nowplayingseek ±10 s, hold to keep going",
  "manipulators": [
    { "type": "basic",
      "from": { "key_code": "right_arrow", "modifiers": { "mandatory": ["left_control", "left_option"] } },
      "to": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek forward --hold --progressive" }],
      "to_after_key_up": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek release" }] },
    { "type": "basic",
      "from": { "key_code": "left_arrow", "modifiers": { "mandatory": ["left_control", "left_option"] } },
      "to": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek backward --hold --progressive" }],
      "to_after_key_up": [{ "shell_command": "/opt/homebrew/bin/nowplayingseek release" }] }
  ]
}
```

A tap is one step; held, the key makes five steps a second, and with `--progressive` they grow.
The pace, the step and how it grows are in the [config file](advanced.md#config-file).

A rotary knob is two keys to the system, one per direction — volume up and down out of
the box. Reassign them in the keyboard's firmware (VIA, QMK) to keys you do not use, such
as F13 and F14, and bind those the same way. Every click of the knob is one press, so with
[`--progressive`](advanced.md#progressive-seek) a fast spin covers more ground than a slow one.

Without third-party software: Shortcuts.app → new shortcut → "Run Shell Script" →
`/opt/homebrew/bin/nowplayingseek forward 10` → ⓘ → "Add Keyboard Shortcut".

Hammerspoon, in `~/.hammerspoon/init.lua`:

```lua
local function run(...)
  local arguments = { ... }
  return function() hs.task.new("/opt/homebrew/bin/nowplayingseek", nil, arguments):start() end
end
hs.hotkey.bind({ "ctrl", "alt" }, "right", run("forward", "--hold", "--progressive"), run("release"))
hs.hotkey.bind({ "ctrl", "alt" }, "left", run("backward", "--hold", "--progressive"), run("release"))
```

skhd, in `~/.config/skhd/skhdrc`:

```
ctrl + alt - right : /opt/homebrew/bin/nowplayingseek forward 10
ctrl + alt - left  : /opt/homebrew/bin/nowplayingseek backward 10
```

BetterTouchTool, Keyboard Maestro, a Raycast script command, a Stream Deck button — anything
that can run a shell command takes the same line. A USB foot pedal is a key like any other:
bind it and you have a transcription pedal for every player.
