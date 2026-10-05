# A keyboard knob as a jog wheel

[← README](../README.md) · [Hotkeys](hotkeys.md)

<p align="center"><img src="images/banner-knob.webp" alt="The panda turns the big knob of a glass keyboard; the handle of the progress bar above slides along" width="100%"></p>

To the Mac a keyboard's knob is two keys, one per direction — volume up and volume down out of
the box. [Karabiner-Elements](https://karabiner-elements.pqrs.org/), a free keyboard customiser,
takes those two keys from that one keyboard and runs `nowplayingseek` on every click. The
laptop's own volume keys stay volume.

Turned carefully, a click is 5 s: short enough to step past an ad without overshooting. Spun
fast, every click is up to four times longer.

## 1. Find the keyboard's two numbers

Open **Karabiner-EventViewer** — it comes with Karabiner-Elements — and its **Devices** tab.
Find the keyboard with the knob and note its `vendor_id` and `product_id`.

## 2. Add the rule

In Karabiner-Elements open **Complex Modifications** and press **Add your own rule**
([their page on it](https://karabiner-elements.pqrs.org/docs/manual/configuration/add-your-own-complex-modifications/)).
Paste this, with your two numbers in both places:

```json
{
  "description": "nowplayingseek: the keyboard knob is a jog wheel",
  "manipulators": [
    {
      "type": "basic",
      "from": {
        "consumer_key_code": "volume_increment",
        "modifiers": { "optional": ["any"] }
      },
      "to": [{
        "shell_command":
          "/opt/homebrew/bin/nowplayingseek forward --knob >/dev/null 2>&1 &"
      }],
      "conditions": [{
        "type": "device_if",
        "identifiers": [{ "vendor_id": 1234, "product_id": 5678 }]
      }]
    },
    {
      "type": "basic",
      "from": {
        "consumer_key_code": "volume_decrement",
        "modifiers": { "optional": ["any"] }
      },
      "to": [{
        "shell_command":
          "/opt/homebrew/bin/nowplayingseek backward --knob >/dev/null 2>&1 &"
      }],
      "conditions": [{
        "type": "device_if",
        "identifiers": [{ "vendor_id": 1234, "product_id": 5678 }]
      }]
    }
  ]
}
```

On an Intel Mac the path is `/usr/local/bin/nowplayingseek`.

## 3. Turn it

Play something and turn the knob: it winds what plays, in whatever app.

## If it does not

- **The knob still changes the volume.** Karabiner-Elements gives a key to the first rule that
  takes it: move this rule above any rule that already rewrites the volume keys. Then check the
  two numbers, and that Karabiner-Elements modifies that keyboard, under Settings → Devices.
- **A fast spin moves only a few seconds.** A command has lost its ending, `>/dev/null 2>&1 &`.
- **Nothing moves at all.** Run `nowplayingseek forward` in Terminal: it says what is wrong —
  nothing is playing, or the player does not seek.

## What each odd part is for

Nothing in the rule is decoration; every part is there because a knob failed without it.

- **`>/dev/null 2>&1 &`** — Karabiner
  [stops a `shell_command` that is still running](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/to/shell-command/)
  when the next one starts, and a knob spun fast sends the next click before the last has
  finished seeking: all but the last one or two were lost. With this ending the shell Karabiner
  stops has already handed the command over and left.
- **`"optional": ["any"]`** — some knobs send every click together with a modifier key. Without
  this line the rule only sees a click that arrives alone.
- **`device_if`** — only this keyboard's volume keys become the jog wheel.
- **The full path** — Karabiner runs commands with a bare environment and finds nothing by its
  short name.

## A knob you can reprogram

If the keyboard's firmware lets you (VIA, QMK, the vendor's app), give the knob two keys nothing
else uses, such as F13 and F14. The rule then needs no numbers: drop `conditions` from both
halves and catch the keys themselves — `f14` for forward, `f13` for backward:

```json
"from": {
  "key_code": "f14",
  "modifiers": { "optional": ["any"] }
}
```

## Tuning

What a click is, and how fast is fast, are four numbers under
[`[knob]` in the config file](advanced.md#knob). One command changes each:

```sh
nowplayingseek config set knob.step 3
```
