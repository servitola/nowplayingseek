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
