# Moving over

[← README](../README.md)

A migration guide. It is short, because the migration is one word.

## From nowplaying-cli

[nowplaying-cli](https://github.com/kirtan-shah/nowplaying-cli) is where this project's author
came from. Step one: replace `nowplaying-cli` with `nowplayingseek`. There is no step two.

```diff
- nowplaying-cli get title artist album
+ nowplayingseek get title artist album
- nowplaying-cli get --json title duration elapsedTime
+ nowplayingseek get --json title duration elapsedTime
- nowplaying-cli get-raw
+ nowplayingseek get-raw
- nowplaying-cli togglePlayPause
+ nowplayingseek togglePlayPause
- nowplaying-cli seek 60
+ nowplayingseek seek 60
```

The same property names, the first letter in either case. The same `null` for what is not there.
The same JSON, from the same system serialiser, down to the space before the colon. The test suite
runs both tools against one player and compares the lines.

If a script depends on every quirk — help and exit 0 for an unknown word, silence after `seek` —
say the old name first and get the whole dialect: `nowplayingseek nowplaying-cli bogus`.

Three things are not the same. `get elapsedTime` answers with the position, `playbackRate` is 0
while paused whatever the player claims, and `get-raw` carries every key macOS holds, where theirs
carries thirteen.

## From media-control

[media-control](https://github.com/ungive/media-control) and its
[mediaremote-adapter](https://github.com/ungive/mediaremote-adapter) found the way back in after
macOS 15.4, and this project stands on that finding. Migration: the same one word.

```diff
- media-control get --now | jq -r .title
+ nowplayingseek get --now | jq -r .title
- media-control stream --no-diff --debounce=200
+ nowplayingseek stream --no-diff --debounce=200
- media-control toggle-play-pause
+ nowplayingseek toggle-play-pause
- media-control skip-fifteen-seconds
+ nowplayingseek skip-fifteen-seconds
- media-control seek 22.4
+ nowplayingseek seek 22.4
- media-control repeat track
+ nowplayingseek repeat track
```

The same keys in `get`, `--micros` and `--now` included. The same envelope in `stream`, which opens
with the same empty payload, sends an item whole and after that only what changed. All fourteen
commands, `send ID`, `shuffle`, `repeat`, `speed`, and the same words when an argument is wrong.
For the rest — `help`, `version`, `test` — say `nowplayingseek media-control` first.

## From playerctl

[playerctl](https://github.com/altdesktop/playerctl) has no build for the Mac: it speaks D-Bus, and
there is none. If your fingers learnt it on Linux, they may keep what they learnt.

```diff
- playerctl play-pause
+ nowplayingseek playerctl play-pause
- playerctl position 30+
+ nowplayingseek playerctl position 30+
- playerctl metadata --format '{{ artist }} - {{ title }}'
+ nowplayingseek playerctl metadata --format '{{ artist }} - {{ title }}'
```

Or, once: `alias playerctl='nowplayingseek playerctl'`. `status`, `play`, `pause`, `play-pause`,
`next`, `previous`, `stop`, `shuffle`, `loop`, `position` to read, to set and to move by, `metadata`
with a key or a format string, and the helpers `duration`, `lc`, `uc`, `trunc`, `default`, `emoji`,
`markup_escape`.

## From mpc and shpotify

[mpc](https://github.com/MusicPlayerDaemon/mpc) has the most sensible way to write a seek, and
[shpotify](https://github.com/hnarayanan/shpotify) has two thousand stars of muscle memory.

```diff
- mpc seek +10
+ nowplayingseek mpc seek +10
- mpc toggle
+ nowplayingseek mpc toggle
- spotify pos 90
+ nowplayingseek spotify pos 90
- spotify status
+ nowplayingseek spotify status
```

`mpc`: `toggle`, `play`, `pause`, `next`, `prev`, `stop`, `current`, `status`, `repeat`, `random`, and
`seek` with a sign, a clock or a percentage. `spotify`: `status` and its parts, `play`, `pause` —
which toggles, as it does there — `next`, `prev`, `pos`, `replay`, `stop`, `toggle shuffle|repeat`.
Neither is limited to its old player any more.

## From one line of AppleScript

```diff
- osascript -e 'tell application "Spotify" to set player position to (player position + 10)'
+ nowplayingseek forward
```

That line was the ancestor of most of the above. It named its player. This one does not have to.

## What is not supported

Honesty, in one place.

- **Artwork bytes.** `artworkData` is `null` or absent. macOS hands the picture over only through
  an asynchronous call that a script inside `osascript` cannot make. Its type, size and identifier
  are there.
- **Choosing a player.** `playerctl -p spotify`, and anything else that names an app. macOS elects
  one Now Playing app and redirects everything to it; five private calls were measured, none gets
  past that. Such a request is refused by name, exit 1.
- **Volume, playlists, search, play by name.** Now Playing has no such thing.
- **Push.** `stream` here looks every 0.2 s; the original is told. A change arrives a fraction of a
  second later, in the same words.
- **`media-control test`.** It can prove itself with a player of its own. Here it is `doctor`: it
  needs something to have played since login.
- **Key order in JSON.** The keys are the same; their order is the system's business.

Each dialect is a remote for the one player macOS elected, not the original tool rebuilt. What was
left out rather than faked: mpc's queue, database, playlists, outputs and stickers; playerctl's
`--follow`, `--all-players`, `--list-all` and arithmetic in format strings; shpotify's search and
play-by-name. Everything named on this page is supported word for word, and if it is not, that is
a bug: [open an issue](https://github.com/servitola/nowplayingseek/issues).
