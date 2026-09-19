const USAGE = `nowplayingseek ${VERSION} — seek whatever is playing on the Mac

Look
  status                         what plays, where, in which app
  watch                          stay: where it is, and what happens to it
  stream                         stay: a log of what happens; JSON in a pipe
  position                       seconds from the start
  duration                       seconds in all

Move
  seek <time>                    to an exact place: seek 754, seek 12:34
  forward [time]                 by a step, 10 s unless told
  backward [time]
    <time> is seconds (90, 12.5) or a clock (1:30, 1:02:03)

Play
  toggle | play | pause | next | previous

Answer
  --json                         where things stand as JSON, indented
  --minify                       as JSON on one line, for scripts
  --raw                          the keys macOS itself holds, as JSON
    on any command above; with no flag the answer is a line for people

For a hotkey
  forward --hold --progressive   key down: keep going, further every step
  release forward                key up: stop
  forward --progressive          the same, for tools that repeat a held key
  forward --knob                 one click of a knob: faster spin, longer step
    backward takes the same

Settings
  config                         what is in effect, and where the file is
  config init                    write ~/.config/nowplayingseek/config.ini
  doctor                         exit 0 when Now Playing can be read

Exit codes
  0                              done
  1                              nothing is playing
  2                              the player did not listen
  64                             bad arguments
  78                             bad config

More
  https://github.com/servitola/nowplayingseek`;
