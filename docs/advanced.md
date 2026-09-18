# Advanced

[← README](../README.md)

Nothing here is needed for everyday use.

## Progressive seek

With `--progressive` the step grows the longer the key is held, a little with every step. A tap
is exactly one step and the first second of holding is almost that, so a short hold stays
precise; then it gathers pace and settles at three times the step — fast enough to cross a
film in a few seconds of holding, and no faster.

| held | each step | in total |
| --- | --- | --- |
| a tap | 10 s | 0:10 |
| 1 s | 10.5 s | 0:50 |
| 2 s | 12 s | 1:48 |
| 3 s | 15 s | 2:59 |
| 5 s | 22 s | 6:10 |
| 7 s | 27 s | 10:19 |
| 10 s | 30 s | 17:29 |

The curve is `1 + (max_multiplier − 1) · (1 − e^−(held / ramp)²)`: `max_multiplier` is where it
settles, `ramp` is how long it takes to get two thirds of the way there.

```ini
[progressive]
pattern = smooth
max_multiplier = 3
ramp = 5
```

Presses in one direction no further apart than `streak_gap` count as one hold, so fast tapping
and a spun knob accelerate too; the other direction, a pause or a `seek` starts over. When the
step was multiplied, the output line ends with the multiplier: `×1.6`.

For steps that jump at moments you choose, `pattern` takes a ladder instead —
`<held seconds>:<multiplier>` points, `s` and `x` optional:

| `pattern` | |
| --- | --- |
| `4s:x2, 8s:x3, ...` | `...` continues at the pace of the last two points — `12s:x4`, `16s:x5` — up to `max_multiplier` |
| `2s:x2, ...` | one point continues from `0s:x1`: +1 every 2 s |
| `3s:x2, 6s:x5, 10s:x20` | no `...`: stays at ×20, if `max_multiplier` lets it |
| `1s:x1.5, 2s:x3, ...` | fractions work: +1.5 every second |

## Hold

Most hotkey tools run a command once per press, however long the key stays down. With `--hold`
the command itself keeps going: `nowplayingseek forward --hold` makes a step every
`interval` seconds until `nowplayingseek release` is run — bind the first to the key down and
the second to the key up. A tap is still one step. Another `--hold` takes over from the one
before it, so switching direction needs no release in between, and a hold ends by itself after
`max_time` in case the release never arrives.

```ini
[hold]
interval = 0.2
max_time = 30
```

It does not wait for a step to land before the next one, only for the last: the exit code tells
whether the player ended up where the hold left it.

## Config file

`~/.config/nowplayingseek/config.ini` (`$XDG_CONFIG_HOME/nowplayingseek/config.ini` when
that is set). The file is optional and so is every key in it; `nowplayingseek config init`
writes one with the defaults and a comment per key, `nowplayingseek config` prints what
is in effect.

Comments are whole lines starting with `;` or `#`. An unknown section or key, or a value
that does not parse, stops every command with exit 78 and the line number — a typo never
silently falls back to a default.
