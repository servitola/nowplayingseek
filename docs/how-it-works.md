# How it works

[← README](../README.md)

## Why it exists

I like a computer that obeys keys. My [dotfiles](https://github.com/servitola/dotfiles) are mostly
that: a Hyper key, layers, a shortcut for everything I do twice. Media had its keys too — play,
pause, next — and one day I added the two that were missing, rewind and fast forward. macOS has
such signals; a keyboard can send them.

They were a disappointment. They give neither a position nor a step of your choosing, and every
player takes them in its own way. There was no "ten seconds back", the one thing I wanted when I
missed a line in a film or a punch in a fight. A player's own arrow keys do it — while its window
is in front, and every player in its own way.

So I wanted to do the seeking myself: read where the player is, add ten seconds, tell it to go
there. macOS knows all of that — it is the thing in the Control Center widget — and keeps it
behind a private door. I tried the tools that open it. One had been broken by macOS 15.4
and stayed so for a year; mended, it still would not move by a step. Nor would the other.

Then a friend bought a keyboard with a knob. Out of the box the knob is volume. He wanted it to
wind the video he was watching, in whatever app, like the jog wheel of an editing desk — slowly
to find a word, with a flick to cross a scene. There was nothing to bind it to.

That was reason enough. This tool is the command behind those keys and that knob: it seeks what
plays by the step you ask for, from anywhere — see [Hotkeys](hotkeys.md). The rest of this page is
what it took.

## Why it is a script

Since macOS 15.4 `mediaremoted` answers Now Playing *reads* only to processes whose code-signing
identifier starts with `com.apple.` (or that hold Apple's private entitlement). Your own compiled
binary gets an empty dictionary and no error. `/usr/bin/osascript` qualifies, so the whole tool is JavaScript
for Automation that loads the private `MediaRemote.framework` inside it. That is the same
loophole [ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter)
uses through `/usr/bin/perl`, minus the helper framework and at about half the latency
(about 50 ms for a whole run). A compiled binary can read too — but only if it is signed with an
identifier that begins `com.apple.`, which is posing as Apple: nothing one can ship, and the first
thing a stricter check would stop. The interpreters Apple ships would survive that check.

Three things the API does not tell you:

- `ElapsedTime` is a snapshot taken at `Timestamp`, not the position. The live position
  is `elapsed + rate × (now − timestamp)`.
- There is no relative seek. `forward` / `backward` read, add, and seek to an absolute time. Now
  Playing refreshes 50–150 ms after a seek — over a second when a page buffers — so
  consecutive presses build on the previous target until it catches up.
- `MRMediaRemoteSendCommand` returns `true` immediately and delivers asynchronously; a
  process that exits right away never sends the command. The tool polls for the effect.

A key held down is two processes, because hotkey tools run a command once per press: `--hold`
on the key down keeps stepping, `release` on the key up tells it to stop through a file in the
temporary directory — one file per direction, which the hold only reads, so a release cannot be
overwritten and lost. A newer `--hold` takes over from an older one through a file of its own.
On a quick tap the `release` can get there first; the `--hold` sees a release newer than itself
and makes its one step.

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
- Seeking needs the player's cooperation. YouTube in Chromium browsers, IINA and VLC work. A
  web page without a MediaSession `seekto` handler swallows the call; you get exit 2.
- Private API. Tested on macOS 26.6 only. Apple can close this door in any update — run
  `nowplayingseek doctor` while something is playing to find out.
