# Questions

[← README](../README.md)

<p align="center"><img src="images/banner-questions.webp" alt="The panda listens with a paw on its headphones under a glass question mark" width="100%"></p>

## Getting started

### How do I skip a few seconds forward or back with a keyboard shortcut, in any app?

Install it, then bind `nowplayingseek forward` and `nowplayingseek backward` to two keys — see
[Hotkeys](hotkeys.md). Each press moves 5 s, whichever app is in front: the command talks to Now
Playing, not to a window.

### Is there a built-in Mac hotkey to rewind 10 seconds?

No. The media keys do play/pause, next and previous; nothing moves by a few seconds. This tool is
that missing key.

### How do I make it skip 10 seconds, or 30?

Put the time in the command, `nowplayingseek forward 10`, or change the default for every key:

```sh
nowplayingseek config set seek.step 10
```

### Which players does it work with?

Whatever shows in the Now Playing widget of Control Center and can seek: IINA, VLC, QuickTime,
Music, Spotify, YouTube in a Chromium browser. A web page that cannot seek answers with exit 2.

### Does it need any permission?

No. It reads and drives Now Playing without Accessibility or Input Monitoring. The app that catches
the key may want its own: Shortcuts needs Allow Running Scripts turned on in its settings.

## Keyboard knob

### Can the knob on my keyboard scrub a video?

Yes. Bind its two directions to `forward --knob` and `backward --knob` — [the rule for
Karabiner-Elements](hotkeys.md#a-knob-in-karabiner-elements). A careful click is 5 s; a fast spin
makes every click up to 20 s, so three spins cover four to six minutes.

### I spin the knob fast and it still moves only a few seconds.

The Karabiner rule needs `>/dev/null 2>&1 &` at the end of each command. Karabiner stops a command
still running when the next click comes, so without it only the last click or two get through.

### The knob still changes the volume.

Karabiner gives a key to the first rule that takes it: move the knob rule above any rule for the
volume keys, and check that Karabiner modifies that keyboard, under Settings → Devices.

## When it misbehaves

### The hotkey moves the wrong player.

macOS drives one app at a time, the one that last started playing, even if it is paused now. Press
play in the app you mean, and the keys follow it. More in [Limits](how-it-works.md#limits).

### It works in Terminal, but not from my hotkey app.

Hotkey apps run commands with almost no environment. Use the full path:
`/opt/homebrew/bin/nowplayingseek` on Apple silicon, `/usr/local/bin/nowplayingseek` on an Intel
Mac. `which nowplayingseek` prints yours.

### What do the exit codes mean?

`0` done, `1` nothing is playing, `2` the player did not listen (a page with no seek support),
`64` a mistake in the command, `78` a mistake in the config file.

### Which macOS versions does it work on?

The ones on the [compatibility page](compatibility.md): the live tests pass there, and new builds
are watched before they ship.

## For developers

### Why does `MRMediaRemoteGetNowPlayingInfo` return nothing in my own program?

Since macOS 15.4 `mediaremoted` answers only processes whose bundle identifier starts with
`com.apple.`. Run the call inside one that qualifies — `/usr/bin/osascript` as here, or
`/usr/bin/perl` as [ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter) does.

### Can a script or an AI agent use it?

Yes: one line in, JSON out with `--json`, and an exit code you can trust. See
[For scripts and AI agents](scripting.md).
