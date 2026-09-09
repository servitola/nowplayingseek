# Hotkeys, knobs and pedals

[← README](../README.md)

The tool does not grab keys itself; bind it with whatever you already use. Give the
full path — hotkey daemons run commands with a bare environment. `nps` is the same tool under
its short name; the recipes use it to keep their lines short.

## A key, in Shortcuts

<p align="center"><img src="images/with-shortcuts.webp" alt="The panda presses a key; a thread of light runs from it through the icon of the Shortcuts app into a player, where the film winds forward" width="70%"></p>

Shortcuts is on every Mac; nothing else to install. One shortcut is one key, so make two.

1. Install the tool: `brew install servitola/tap/nowplayingseek` ([Homebrew](https://brew.sh) first,
   if `brew` is not there).
2. Open **Shortcuts**, press **+**. Name the shortcut `Forward 30 s`.
3. In the search box on the right, type `shell` and double-click **Run Shell Script**.
4. Replace what is in its box with `/opt/homebrew/bin/nowplayingseek forward 30`. On an Intel Mac
   the path is `/usr/local/bin/nowplayingseek`. The full path matters: Shortcuts runs a script
   with a bare `PATH`.
5. Press ▶ at the top to try it while something plays. The first run stops and asks: Shortcuts →
   Settings → Advanced → **Allow Running Scripts**. Tick it and press ▶ again; the film moves.
6. Press **ⓘ** (Shortcut Details) → **Add Keyboard Shortcut**, and press the keys you want —
   `⌃⌥→` is free in most apps.
7. Duplicate the shortcut (right-click → Duplicate), name it `Back 30 s`, change `forward` to
   `backward`, give it `⌃⌥←`.

Any step works: `forward 10`, `backward 5`, `seek 0`. **ⓘ** → **Pin in Menu Bar** puts the same
shortcut under the Shortcuts icon in the menu bar, and Siri runs it by its name.

Shortcuts tells a press, not a release, so a held key does nothing more than a press. For a hold
that gathers pace, and for a knob, the next section.

If nothing happens, put `/opt/homebrew/bin/nowplayingseek doctor` in the box and press ▶: it says
whether this Mac lets Now Playing be read. Exit code 1 from a shortcut means nothing is playing.

## A key, in Karabiner-Elements

<p align="center"><img src="images/with-karabiner.webp" alt="The panda, in a cap worn backwards, presses a key; a thread of light runs from it through the icon of Karabiner-Elements into a player, where the film winds forward" width="70%"></p>

[Karabiner-Elements](https://karabiner-elements.pqrs.org/) is a free keyboard customiser for
macOS. ⌃⌥→ and ⌃⌥←: Karabiner runs a `shell_command` once per press and does not
repeat it while the key is held, so the key down starts a [`--hold`](advanced.md#hold) and the
key up ends it:

```json
{
  "description": "nowplayingseek ±10 s, hold to keep going",
  "manipulators": [
    {
      "type": "basic",
      "from": {
        "key_code": "right_arrow",
        "modifiers": { "mandatory": ["left_control", "left_option"] }
      },
      "to": [{
        "shell_command": "/opt/homebrew/bin/nps forward --hold --progressive"
      }],
      "to_after_key_up": [{
        "shell_command": "/opt/homebrew/bin/nps release forward"
      }]
    },
    {
      "type": "basic",
      "from": {
        "key_code": "left_arrow",
        "modifiers": { "mandatory": ["left_control", "left_option"] }
      },
      "to": [{
        "shell_command": "/opt/homebrew/bin/nps backward --hold --progressive"
      }],
      "to_after_key_up": [{
        "shell_command": "/opt/homebrew/bin/nps release backward"
      }]
    }
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
    {
      "type": "basic",
      "from": { "key_code": "f14" },
      "to": [{
        "shell_command": "/opt/homebrew/bin/nps forward --knob"
      }]
    },
    {
      "type": "basic",
      "from": { "key_code": "f13" },
      "to": [{
        "shell_command": "/opt/homebrew/bin/nps backward --knob"
      }]
    }
  ]
}
```

Every click of the knob is one run of the command, and the tool reads the pace of the clicks: a
slow click is 2 s, fine enough to find a word; a flick makes every click up to four times
longer. The step, the limit and what counts as fast are `[knob]` in the
[config file](advanced.md#config-file).

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
