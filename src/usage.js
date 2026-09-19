const USAGE = `nowplayingseek ${VERSION} — seek whatever is playing on the Mac

Look
  status [--json | --raw]        what plays, where, in which app; --raw is all macOS knows
  watch                          stay, and show where it is and what happens to it
  position                       seconds from the start
  duration                       seconds in all

Move
  seek <time>                    to an exact place: seek 754, seek 12:34
  forward [time]                 by a step, 10 s unless told
  backward [time]
    <time> is seconds (90, 12.5) or a clock (1:30, 1:02:03)

Play
  toggle | play | pause | next | previous

For a hotkey
  forward --hold --progressive   key down: keep going, a little further with every step
  release forward                key up: stop
  forward --progressive          the same growth, for tools that repeat a held key themselves
  forward --knob                 one click of a keyboard knob: a faster spin, a longer step
    backward takes the same

Settings
  config                         what is in effect, and where the file is
  config init                    write ~/.config/nowplayingseek/config.ini
  doctor                         exit 0 when Now Playing can be read

exit codes: 0 done · 1 nothing is playing · 2 the player did not listen · 64 usage · 78 config
More: https://github.com/servitola/nowplayingseek`;
