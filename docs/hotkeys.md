# Hotkeys and pedals

[← README](../README.md)

<p align="center"><img src="images/banner-hotkeys.webp" alt="The panda presses a glowing fast-forward key; a thread of light runs from it to a glass player, where a car races ahead" width="100%"></p>

The tool does not grab keys itself; bind it with whatever you already use. Give the
full path — hotkey daemons run commands with a bare environment. The Karabiner-Elements rules
spell out `nowplayingseek`; the other recipes use `nps`, the same tool under its short name.

## A key, in Shortcuts

<p align="center"><img src="images/with-shortcuts.webp" alt="The panda presses a key; a thread of light runs from it through the icon of the Shortcuts app into a player, where the film winds forward" width="70%"></p>

Shortcuts is on every Mac; nothing else to install. The full, beginner-proof walkthrough —
built for someone who has never opened Terminal — is its own page:
[A keyboard shortcut, with the Shortcuts app](shortcuts.md).

Any step works: `forward 10`, `backward 5`, `seek 0`. **ⓘ** → **Pin in Menu Bar** puts the same
shortcut under the Shortcuts icon in the menu bar, and Siri runs it by its name.

Shortcuts tells a press, not a release, so a held key does nothing more than a press.

## A key, in Karabiner-Elements

<p align="center"><img src="images/with-karabiner.webp" alt="The panda, in a cap worn backwards, presses a key; a thread of light runs from it through the icon of Karabiner-Elements into a player, where the film winds forward" width="70%"></p>

[Karabiner-Elements](https://karabiner-elements.pqrs.org/) is a free keyboard customiser for
macOS. ⌃⌥→ and ⌃⌥←: Karabiner runs a `shell_command` once per press and does not
repeat it while the key is held, so the key down starts a [`--hold`](advanced.md#hold) and the
key up ends it. In Karabiner-Elements: **Complex Modifications** → **Add your own rule**, and
paste:

```json
{
  "description": "nowplayingseek ±5 s, hold to keep going",
  "manipulators": [
    {
      "type": "basic",
      "from": {
        "key_code": "right_arrow",
        "modifiers": { "mandatory": ["left_control", "left_option"] }
      },
      "to": [{
        "shell_command":
          "/opt/homebrew/bin/nowplayingseek forward --hold --progressive >/dev/null 2>&1 &"
      }],
      "to_after_key_up": [{
        "shell_command":
          "/opt/homebrew/bin/nowplayingseek release forward >/dev/null 2>&1 &"
      }]
    },
    {
      "type": "basic",
      "from": {
        "key_code": "left_arrow",
        "modifiers": { "mandatory": ["left_control", "left_option"] }
      },
      "to": [{
        "shell_command":
          "/opt/homebrew/bin/nowplayingseek backward --hold --progressive >/dev/null 2>&1 &"
      }],
      "to_after_key_up": [{
        "shell_command":
          "/opt/homebrew/bin/nowplayingseek release backward >/dev/null 2>&1 &"
      }]
    }
  ]
}
```

Every command ends in `>/dev/null 2>&1 &`. Karabiner
[stops a `shell_command` that is still running](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/to/shell-command/)
when the next one starts; with this ending the shell Karabiner stops has already handed the
command over and left.

A tap is one step. Held, the key glides off in small steps, five a second, and with
`--progressive` they grow — see [the curve](advanced.md#progressive-seek). The pace, the step and
how it grows are in the [config file](advanced.md#config-file).

## A knob

A keyboard's knob is two more keys, and the rule that makes it a jog wheel has its own page:
[A keyboard knob as a jog wheel](knob.md).

## Other tools

Hammerspoon, in `~/.hammerspoon/init.lua`:

```lua
local nps = "/opt/homebrew/bin/nps"
local function run(...)
  local arguments = { ... }
  return function() hs.task.new(nps, nil, arguments):start() end
end
local keys = { "ctrl", "alt" }
hs.hotkey.bind(keys, "right",
  run("forward", "--hold", "--progressive"), run("release", "forward"))
hs.hotkey.bind(keys, "left",
  run("backward", "--hold", "--progressive"), run("release", "backward"))
```

skhd, in `~/.config/skhd/skhdrc`:

```
ctrl + alt - right : /opt/homebrew/bin/nowplayingseek forward 10
ctrl + alt - left  : /opt/homebrew/bin/nowplayingseek backward 10
```

BetterTouchTool, Keyboard Maestro, a Raycast script command, a Stream Deck button — anything
that can run a shell command takes the same line. A USB foot pedal is a key like any other:
bind it and you have a transcription pedal for every player.
