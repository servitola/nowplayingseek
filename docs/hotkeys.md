# Hotkeys, knobs and pedals

[← README](../README.md)

The tool does not grab keys itself; bind it with whatever you already use. Give the
full path — hotkey daemons run commands with a bare environment. `nps` is the same tool,
short name, used below to keep the recipes' lines short.

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
key up ends it:

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
          "/opt/homebrew/bin/nps forward --hold --progressive >/dev/null 2>&1 &"
      }],
      "to_after_key_up": [{
        "shell_command":
          "/opt/homebrew/bin/nps release forward >/dev/null 2>&1 &"
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
          "/opt/homebrew/bin/nps backward --hold --progressive >/dev/null 2>&1 &"
      }],
      "to_after_key_up": [{
        "shell_command":
          "/opt/homebrew/bin/nps release backward >/dev/null 2>&1 &"
      }]
    }
  ]
}
```

Every command ends in `>/dev/null 2>&1 &`. Karabiner
[stops a `shell_command` that is still running](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/to/shell-command/)
when the next one starts, so a knob spun fast killed every click but the last one or two before it
could seek. With this ending the shell Karabiner stops has already handed the command over and left.

A tap is one step. Held, the key glides off in small steps, five a second, and with
`--progressive` they grow — see [the curve](advanced.md#progressive-seek). The pace, the step and
how it grows are in the [config file](advanced.md#config-file).

## A knob, in Karabiner-Elements

<p align="center"><img src="images/banner-knob.webp" alt="The panda turns the big knob of a glass keyboard; the handle of the progress bar above slides along" width="100%"></p>

A mechanical keyboard's knob is a jog wheel: two keys to the system, one per direction — volume
up and down out of the box. Reassign them in the keyboard's firmware (VIA, QMK, the vendor's app)
to keys you do not use, such as F13 and F14, and give those to `--knob`:

```json
{
  "description": "nowplayingseek: the keyboard knob is a jog wheel",
  "manipulators": [
    {
      "type": "basic",
      "from": {
        "key_code": "f14",
        "modifiers": { "optional": ["any"] }
      },
      "to": [{
        "shell_command":
          "/opt/homebrew/bin/nps forward --knob >/dev/null 2>&1 &"
      }]
    },
    {
      "type": "basic",
      "from": {
        "key_code": "f13",
        "modifiers": { "optional": ["any"] }
      },
      "to": [{
        "shell_command":
          "/opt/homebrew/bin/nps backward --knob >/dev/null 2>&1 &"
      }]
    }
  ]
}
```

Every click of the knob is one run of the command, and the tool reads the pace of the clicks: a
careful click is 5 s, short enough to step past an ad without overshooting; a fast spin makes
every click up to four times longer. What a click is, and how fast is fast, are `[knob]` in the
[config file](advanced.md#knob); one command changes each: `nps config set knob.step 3`.

Karabiner-Elements gives a key to the first rule that takes it, so put this rule above any rule
that already rewrites the knob's keys — such as one that turns the volume keys into fine volume
steps — or that rule takes every click and this one never sees it.

If the firmware cannot be changed, take the volume keys themselves, but only from that
keyboard, so the laptop's own volume keys stay volume. Karabiner-EventViewer, the Devices tab,
shows each keyboard's `vendor_id` and `product_id`; put them in a `device_if` condition on both
manipulators:

```json
{
  "type": "basic",
  "from": {
    "consumer_key_code": "volume_increment",
    "modifiers": { "optional": ["any"] }
  },
  "to": [{
    "shell_command":
      "/opt/homebrew/bin/nps forward --knob >/dev/null 2>&1 &"
  }],
  "conditions": [{
    "type": "device_if",
    "identifiers": [{ "vendor_id": 1234, "product_id": 5678 }]
  }]
}
```

`"optional": ["any"]` lets the rule catch a click that arrives with a modifier key — from the
keyboard's firmware, or from another rule placed above it.

The second one is the same with `volume_decrement` and `backward`. If the knob still changes the
volume, check that Karabiner-Elements modifies that keyboard, under Settings → Devices.

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
