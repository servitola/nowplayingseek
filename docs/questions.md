# Questions

[← README](../README.md)

**How do I skip forward 10 seconds on a Mac with a keyboard shortcut, in any app?** Install
the tool and bind `nowplayingseek forward 10` to a key — see [Hotkeys](hotkeys.md). The key
works whichever app is in front, because it talks to Now Playing and not to a window.

**Is there a Mac hotkey to rewind 10 seconds?** Not built in. The media keys do play/pause,
next and previous; `nowplayingseek backward 10` on a hotkey is the missing one.

**Can the knob on my keyboard scrub a video?** Yes: remap its two directions to spare keys
in VIA or QMK, bind them to `forward` and `backward`, add `--progressive` so that a fast spin
goes further.

**Why does `MRMediaRemoteGetNowPlayingInfo` return nothing in my own program?** Since macOS
15.4 `mediaremoted` answers only processes whose bundle identifier starts with `com.apple.`.
Run the call inside one that qualifies — `/usr/bin/osascript` as here, or `/usr/bin/perl` as
[ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter) does.

**The hotkey moves the wrong player.** macOS elects one app as Now Playing, and that is the
one driven — see [Limits](how-it-works.md#limits). Press play in the app you mean.

**Exit 2 on a web page.** The page has no MediaSession `seekto` handler; nothing outside the
browser can seek it.
