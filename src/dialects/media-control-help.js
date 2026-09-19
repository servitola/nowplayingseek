// The help page of media-control 0.7.7 (https://github.com/ungive/media-control, BSD 3-Clause,
// © 2025 Jonas van den Berg), so that its dialect answers `help` the way it does.
const MC_HELP = `Example usage:
  media-control get
  media-control stream
  media-control toggle-play-pause
  media-control repeat track
  media-control seek 22.4

Metadata:
  get      Read now playing information once
  stream   Stream updates to now playing information

Controls:
  seek POSITION   Seek to a specific timeline position (seconds)
  shuffle MODE    Set the shuffle mode: off (1), albums (2), tracks (3)
  repeat MODE     Set the repeat mode: off (1), track (2), playlist (3)
  speed SPEED     Set the playback speed

Commands:                                                 ID:
  play                      Start playback                  0
  pause                     Pause playback                  1
  toggle-play-pause         Toggle between play and pause   2
  stop                      Stop playback                   3
  next-track                Skip to the next track          4
  previous-track            Return to the previous track    5
  toggle-shuffle            Toggle shuffle mode             6
  toggle-repeat             Toggle repeat mode              7
  start-forward-seek        Start seeking forward           8
  end-forward-seek          Stop seeking forward            9
  start-backward-seek       Start seeking backward          10
  end-backward-seek         Stop seeking backward           11
  go-back-fifteen-seconds   Go back 15 seconds              12
  skip-fifteen-seconds      Skip ahead 15 seconds           13
  send ID                   Send a command by its ID

Testing:
  test   Tests whether the tool is able to operate on this macOS version.
         An exit code other than 0 indicates that the tool is not functional.

Options:
  get
    --now: Adds an "elapsedTimeNow" key with an estimation of the current
      elapsed playback time. This estimation may be off by up to a second.
      To determine a more accurate time without polling "get" continuously,
      calculate it using the "elapsedTime" and "timestamp" keys. "elapsedTime"
      contains the elapsed time at the time that is stored in "timestamp".
  stream
    --no-diff: Disable diffing and always dump all metadata
    --debounce=N: Delay in milliseconds to prevent spam (0 by default)
  get, stream
    --micros: Replaces the following time keys with microsecond equivalents:
      "duration" -> "durationMicros"
      "elapsedTime" -> "elapsedTimeMicros"
      "elapsedTimeNow" -> "elapsedTimeNowMicros"
      "timestamp" -> "timestampEpochMicros" (converted to epoch time)
    --no-artwork: Omits "artworkData" and "artworkMimeType" from the payload.
      Useful for consumers that do not render artwork, since this avoids
      emitting several hundred kilobytes of base64 data per update.
    --allow-missing-title: By default, media with a null or absent title is
      ignored. This flag leads to media with a null or absent title being
      emitted. The consumer needs to explicitly handle the possibility of the
      title being null or absent.
    --human-readable, -h: Makes values human-readable. Use only for debugging.
      The JSON output is pretty-printed and the following keys are adapted:
      "artworkData" -> Binary data is truncated to a shorter representation
  seek
    --micros: Interpret the passed value as microseconds

Other:
  help      Prints this help page
  version   Prints the version and license information
`;
