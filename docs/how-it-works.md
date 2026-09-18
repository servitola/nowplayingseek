# How it works

[← README](../README.md)

## Why it exists

I wanted two keys on my keyboard: 10 seconds back and 10 seconds forward, for whatever
is playing, whichever app has the focus. macOS cannot do that. Its media keys cover
play/pause, next and previous; the `fast_forward` / `rewind` keys give you neither a
position nor a step of your choice; and a player's own arrow-key shortcuts work only
while its window is focused — and differ from player to player.

So this is a command that seeks the current item by exactly the step you ask for, and
any hotkey tool can call it — see [Hotkeys](hotkeys.md).

It gets better if your keyboard has a rotary knob, as many mechanical ones do. Bind the
two directions of the knob to `forward` and `backward` and it becomes a jog wheel: turn it
to scrub through the video or the podcast, in any app, without reaching for the mouse.

## Why it is a script

Since macOS 15.4 `mediaremoted` answers Now Playing *reads* only to processes whose
bundle identifier starts with `com.apple.`. Your own compiled binary gets an empty
dictionary and no error. `/usr/bin/osascript` qualifies, so the whole tool is JavaScript
for Automation that loads the private `MediaRemote.framework` inside it. That is the same
loophole [ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter)
uses through `/usr/bin/perl`, minus the helper framework and at about half the latency
(~60 ms per read). Rewriting this in Swift or Go would break it.

Three things the API does not tell you:

- `ElapsedTime` is a snapshot taken at `Timestamp`, not the position. The live position
  is `elapsed + rate × (now − timestamp)`.
- There is no relative seek. `forward` / `backward` read, add, and seek to an absolute time. Now
  Playing refreshes 50–150 ms after a seek — over a second when a page buffers — so
  consecutive presses build on the previous target until it catches up.
- `MRMediaRemoteSendCommand` returns `true` immediately and delivers asynchronously; a
  process that exits right away never sends the command. The tool polls for the effect.

## Limits

- It drives the app macOS elected as Now Playing — the one in the Control Center widget —
  and nothing else. macOS elects the app that *started playback most recently* and keeps it
  elected for minutes after it pauses, even while another app is audibly playing. So after
  a voice message in a messenger, the hotkeys drive the paused messenger, not the video you
  are watching. Press play in the app you mean and it is elected again.
- There is no way around that from outside. `MRMediaRemoteSendCommandToPlayer`,
  `…ToApp`, `…ToClient` and `MRNowPlayingRequest` all accept a target, and for an
  unentitled caller `mediaremoted` silently redirects every one of them to the elected
  app; only Apple's own Music is addressed as asked (measured on macOS 26.6).
- Seeking needs the player's cooperation. YouTube in Chromium browsers and IINA work. A
  web page without a MediaSession `seekto` handler swallows the call; you get exit 2.
- Private API. Tested on macOS 26.6 only. Apple can close this door in any update — run
  `nowplayingseek doctor` while something is playing to find out.
