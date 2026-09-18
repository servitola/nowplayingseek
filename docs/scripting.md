# For scripts and AI agents

[← README](../README.md)

Every command is one line in, one line out, and the exit code is the truth: `0` it happened,
`1` nothing is playing, `2` the player ignored it, `64` bad arguments, `78` bad config.

| Asked | Run |
| --- | --- |
| what is playing, where am I, how much is left | `nowplayingseek status --json` — `position` and `duration` in seconds, `playing`, `app` |
| go back a minute | `nowplayingseek backward 60` |
| jump to 12:30 | `nowplayingseek seek 12:30` |
| pause, resume, next | `nowplayingseek pause`, `play`, `next` |
| can this Mac be driven at all | `nowplayingseek doctor` |

Only the elected app can be addressed. When `status` shows another player than the one the
person means, tell them to press play there; do not retry.
