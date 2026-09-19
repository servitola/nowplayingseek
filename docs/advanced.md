# Advanced

[← README](../README.md)

Nothing here is needed for everyday use.

## Progressive seek

With `--progressive` the step grows the longer the key is held, a little with every step. A press
is always one whole step. Keep the key down and it glides off in small steps, so a short hold
stays short; then it gathers pace and settles at two and a half times the step. A hold ends by
itself after ten seconds, which is about twelve minutes of film: nobody seeks further by a key.

| held | each step | in total |
| --- | --- | --- |
| a tap | 10 s | 0:10 |
| 1 s | 5 s | 0:26 |
| 2 s | 6 s | 0:52 |
| 3 s | 9 s | 1:28 |
| 5 s | 14 s | 3:20 |
| 7 s | 20 s | 6:10 |
| 10 s | 24 s | 11:38 |

The curve is `start + (max_multiplier − start) · (1 − e^−(held / ramp)²)`: where it begins, where
it settles, and how long it takes to get about two thirds of the way.

```ini
[progressive]
start = 0.4
max_multiplier = 2.5
ramp = 6
```

The curve multiplies whatever step you give: `forward 30 --hold --progressive` is a 30 s press, then
steps from 12 s up to 75 s — three times the pace of the table above. Lower `max_multiplier` if
a long step makes a long hold too fast.

Separate presses no further apart than `streak_gap` count as one hold and grow the same way, but
never drop below a whole step; the other direction, a pause or a `seek` starts over. When the
step was multiplied, the output line ends with the multiplier: `×1.4`.

## Knob

`forward --knob` and `backward --knob` are one click of a keyboard knob. The tool measures the
pace of the clicks and lengthens the step with it, by the same kind of curve: a slow click is
`step`, a flick settles at `max_multiplier` times that, and `fast` is the pace, in clicks a
second, that gets about two thirds of the way there.

```ini
[knob]
step = 2
max_multiplier = 4
fast = 18
```

## Hold

Most hotkey tools run a command once per press, however long the key stays down. With `--hold`
the command itself keeps going: `nowplayingseek forward --hold` makes a step every
`interval` seconds until `nowplayingseek release forward` is run — bind the first to the key
down and the second to the key up. The release names its direction so that, when fingers roll
from one key to the other, letting go of the first does not stop the second; a bare `release`
stops both. A tap is still one step. Another `--hold` takes over from the one
before it, so switching direction needs no release in between, and a hold ends by itself after
`max_time` in case the release never arrives.

```ini
[hold]
interval = 0.2
max_time = 10
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
