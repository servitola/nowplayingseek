# For scripts and AI agents

[← README](../README.md)

<p align="center"><img src="images/banner-scripting.webp" alt="The panda types at a glass terminal; a ribbon of light runs from it to a player tile" width="100%"></p>

Every command of ours is one line in, and the exit code is the truth (behind the names of
nowplaying-cli and media-control it is 0, as theirs is): `0` it happened,
`1` nothing is playing, `2` the player ignored it, `64` bad arguments, `78` bad config.

| Asked | Run |
| --- | --- |
| what is playing, where am I, how much is left | `nowplayingseek status --json` — `position` and `duration` in seconds, `playing`, `app` |
| the same on one line, for `read`, `sed` and logs | `nowplayingseek status --minify` |
| everything macOS knows about the item | `nowplayingseek status --raw` — chapters, media type, artwork size, the file's URL |
| pause and learn where it stopped, in one call | `nowplayingseek pause --json` |
| go back a minute | `nowplayingseek backward 60` |
| jump to 12:30 | `nowplayingseek seek 12:30` |
| pause, resume, next | `nowplayingseek pause`, `play`, `next` |
| can this Mac be driven at all | `nowplayingseek doctor` |
| the cover art, as a file | `nowplayingseek artwork` — prints where it wrote it |
| follow every change, for a status bar | `nowplayingseek stream --no-artwork` — [below](#following-changes) |

Every command that reads or moves the player answers with where things stand, and the three flags
work on all of them: `seek 12:30 --json`, `forward --minify`, `position --json`, `doctor --json`,
`config --json`. `--json` is indented in a pipe as in a terminal; only a terminal gets colour. The
`human` object at the end repeats `position`, `duration`, `timestamp` and `app` in words — parse
with `jq`, or take `--minify` and the first match. The order of flags does not matter; `--raw`
with `--json` is `--raw`.

A terminal gets a painted status line; a pipe, a file or a hotkey daemon gets the plain one,
`▶ 30:57 / 3:15:50  Title  (bundle.id)`, and that one does not change.

Only the elected app can be addressed. When `status` shows another player than the one the
person means, tell them to press play there; do not retry.

## Following changes

`nowplayingseek stream` stays and reports what happens: a play, a pause, a seek, a new item. A
terminal gets a log in words. A pipe gets JSON, one object a line, in the protocol of
[media-control](migrating.md#from-media-control), so a status bar written for it reads this
unchanged. The first line has an empty payload, the next one the item whole, and after that only
the keys that changed; `--no-diff` sends the item whole every time.

```sh
nowplayingseek stream --no-artwork | jq --unbuffered -c '.payload'
```

- `elapsedTime` is the position at `timestamp`, not now: while `playing`, add the seconds since.
- `--no-artwork` drops the cover, several hundred kilobytes of base64 with every new item.
- `--debounce=200` holds a burst of seeks back to one line; a play or a pause comes at once.
- `--micros` gives the times in whole microseconds, with `Micros` in their keys.
- It looks every 0.2 s, so a change arrives a fraction of a second late. It ends when its reader
  does: `stream | head -2` returns.
