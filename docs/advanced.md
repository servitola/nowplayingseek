# Advanced

[← README](../README.md)

Nothing here is needed for everyday use.

## Progressive seek

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

## Config file

`~/.config/nowplayingseek/config.ini` (`$XDG_CONFIG_HOME/nowplayingseek/config.ini` when
that is set). The file is optional and so is every key in it; `nowplayingseek config init`
writes one with the defaults and a comment per key, `nowplayingseek config` prints what
is in effect.

Comments are whole lines starting with `;` or `#`. An unknown section or key, or a value
that does not parse, stops every command with exit 78 and the line number — a typo never
silently falls back to a default.
