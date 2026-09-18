# Advanced

[← README](../README.md)

<p align="center"><img src="images/banner-advanced.webp" alt="The panda pushes one glass fader up; above, a curve that starts flat, rises and levels off" width="100%"></p>

Nothing here is needed for everyday use.

## Progressive seek

With `--progressive` the step grows the longer the key is held, a little with every step. A press
is always one whole step. Keep the key down and it glides off in small steps, so a short hold
stays short; then it gathers pace and settles at two and a half times the step: ten seconds of
holding are about twelve minutes of film, twenty are half an hour.

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
second, that gets about two thirds of the way there. A time in the command itself,
`forward 3 --knob`, is the slow click for that binding in place of `step`.

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
max_time = 60
```

It does not wait for a step to land before the next one, only for the last: the exit code tells
whether the player ended up where the hold left it.

## Config file

`~/.config/nowplayingseek/config.ini` (`$XDG_CONFIG_HOME/nowplayingseek/config.ini` when
that is set). The file is optional and so is every key in it. `nowplayingseek config init` writes
one with every key commented out: remove the `; ` in front of a line to put it in force, and what
stays commented keeps following the defaults. `nowplayingseek config` prints what is in effect.

`nowplayingseek config set knob.fast 24` changes one setting without opening the file: the value
is checked first, the line is put in force where it stands, and a file that does not exist yet is
written as `config init` would, with this one line live. A config symlinked from dotfiles stays a
symlink.

Comments are whole lines starting with `;` or `#`. A config file outlives the version that reads
it, so an unknown section or key — a newer release's setting, or an older one's — is ignored: the
rest of the file still applies, and the command still runs. It is named once on stderr, with the
line number, so a real typo does not pass in silence. A value that does not parse for a key this
build *does* know stops every command with exit 78 and the line number — that is a mistake the
tool can prove, not a version difference.
