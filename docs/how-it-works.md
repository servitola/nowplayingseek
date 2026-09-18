# How it works

[← README](../README.md)

<p align="center"><img src="images/banner-how-it-works.webp" alt="The panda shines a flashlight into an opened glass player full of gears and wires" width="100%"></p>

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
(about 50 ms for a whole run) — except for artwork, which needs perl too; see
[Artwork](#artwork). A compiled binary can read too — but only if it is signed with an
identifier that begins `com.apple.`, which is posing as Apple: nothing one can ship, and the first
thing a stricter check would stop. The interpreters Apple ships would survive that check.

Three things the API does not tell you:

- `ElapsedTime` is a snapshot taken at `Timestamp`, not the position. The live position
  is `elapsed + rate × (now − timestamp)`.
- There is no relative seek. `forward` / `backward` read, add, and seek to an absolute time. Now
  Playing refreshes 50–150 ms after a seek in IINA, about 0.6 s in VLC, over a second when a
  page buffers — so
  consecutive presses build on the previous target until it catches up.
- `MRMediaRemoteSendCommand` returns `true` immediately and delivers asynchronously; a
  process that exits right away never sends the command. The tool polls for the effect.

A key held down is two processes, because hotkey tools run a command once per press: `--hold`
on the key down keeps stepping, `release` on the key up tells it to stop through a file in the
temporary directory — one file per direction, which the hold only reads, so a release cannot be
overwritten and lost. A newer `--hold` takes over from an older one through a file of its own.
On a quick tap the `release` can get there first; the `--hold` sees a release newer than itself
and makes its one step.

## Artwork

The one call that carries `ArtworkData`, `MRMediaRemoteGetNowPlayingInfo(queue, block)`, wants a
real Objective-C block — compiled code, not a script; what was tried from inside `osascript`
instead, and measured to fail, is in [Limits](#limits) below. `native/artwork.m` is that compiled
code: built by clang at `make build` time, never shipped built, and loaded — not run — by
`/usr/bin/perl` through `DynaLoader::dl_load_file`, the way
[ungive/mediaremote-adapter](https://github.com/ungive/mediaremote-adapter) (BSD-3-Clause) loads
its own framework the same way. `src/system/artwork.js` is the rest: one function, artwork only,
no argv parsing or XS boilerplate — `nps_get_artwork` is a plain zero-argument C function, which
works as a Perl XSUB because `dl_install_xsub` calls it with arguments it simply never reads.

This is not the dylib `osascript` refused ([Dead ends](#dead-ends) below): that binary was mapped into
`osascript` itself, which is arm64e and only maps arm64e code back. Perl is plain arm64 and maps a
plain arm64 bundle same as it always could, and perl — like osascript — is signed `com.apple.perl`,
which is what macOS 15.4's Now Playing gate actually checks: the signature of the process asking,
not of every image mapped into it. The bundle itself ships signed to no one: `codesign` shows
`adhoc,linker-signed`, and it is built locally at install time, never distributed built.

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
- No artwork bytes from `osascript` alone. `MRNowPlayingRequest.localNowPlayingItem.nowPlayingInfo`
  — the dictionary `--raw` prints — carries `ArtworkDataHeight`, `ArtworkDataWidth`,
  `ArtworkIdentifier` and `ArtworkMIMEType`, never `ArtworkData`; the item's own `artwork` accessor
  reads nil and its `metadata` object has no `artwork` selector to fall back to (checked on a
  browser tab's Now Playing item, macOS 26.6.2). `ObjC.bindFunction` takes `id` for the block
  argument of `MRMediaRemoteGetNowPlayingInfo(queue, block)` but builds no block from a plain JS
  function — passing one behaved exactly like passing an explicit `$()` (nil): the call returns at
  once, no exception, and the handler never runs even after two seconds spun on
  `NSRunLoop.currentRunLoop`. Reading a class's full method table to look for another synchronous
  accessor hits the same wall as the dylib dead end [below](#dead-ends): `class_copyMethodList` returns
  an opaque array JXA cannot index without pointer arithmetic. [Artwork](#artwork) above is how the
  bytes are gotten instead: not from `osascript`, but from a real block in compiled code loaded
  into `/usr/bin/perl`.
- No hotkeys of our own. A `setup` command that bound a key itself, through a small Swift helper
  using Carbon's `RegisterEventHotKey` (the one hotkey API that needs no Accessibility or Input
  Monitoring permission), was built and then dropped: on macOS 26.6 the helper never received a
  single press. Registration returns `noErr` for every keycode — including combinations other apps
  already hold, so `eventHotKeyExistsErr` cannot be used to detect a clash either — and the
  handler installed on `GetEventDispatcherTarget()` is simply never called from a `CFRunLoopRun()`
  process, whether it is a bare binary, a `TransformProcessType` UIElement, or a signed `.app`
  bundle launched with `open`. Hammerspoon, bound to the same combination on the same machine at
  the same moment, fired every time. The likely difference is the event loop — Carbon events reach
  a process through `NSApplication`, not a plain run loop — but the fix was not worth a helper
  binary in a tool that has none: people already bind keys with Karabiner-Elements, Raycast,
  Hammerspoon or Shortcuts, and [docs/hotkeys.md](hotkeys.md) covers those.
- No Mac App Store. The tool works by loading the private, undocumented `MediaRemote.framework`
  inside `/usr/bin/osascript`, with no entitlement of any kind — see [Why it is a
  script](#why-it-is-a-script). App Store review is public-API only; this would not pass it, and
  even if it somehow did, Apple could still close the read gate in an update and take the listing
  down with it. Homebrew and the release tarball (`docs/install.md`) don't have that review to
  pass, so that is where it ships.

## Dead ends

Measured 2026-09-18 on macOS 26.6; do not retry.

- **Addressing a non-elected player.** Five routes (`MRNowPlayingRequest initWithPlayerPath:`,
  `MRMediaRemoteSendCommandToPlayer` with a plain and with a resolved `MRPlayerPath`,
  `…SendCommandToApp`, `…SendCommandToClient`), all through perl + a compiled arm64e helper
  because JXA cannot pass blocks. A seek addressed to Vivaldi or IINA landed on the elected
  Music every time; only Music itself is addressed as asked. vorssaint-utils documents the same:
  "The service may redirect unprivileged requests to the global player."
- **`MRMediaRemoteSetOverriddenNowPlayingApplication` / `…SetNowPlayingApplicationOverrideEnabled`.**
  Never call them. They elect nobody and leave `mediaremoted` with no elected app at all —
  playback starting in other apps no longer elects them, and turning the override off does
  not help. The only fix was `sudo killall mediaremoted`.
- **Chapters.** `MRMediaRemoteCommandNextChapter` / `PreviousChapter` (100, 101) are delivered and IINA
  ignores them: it registers no chapter handler with the system. `ChapterNumber` and
  `TotalChapterCount` can be read; chapter times cannot. Moving by chapter needs a driver for the
  player, which the owner has ruled out.
- **A helper dylib inside `osascript`.** Refused: "mapping process is a platform binary, but
  mapped file is not". perl, ruby and python load a plain arm64 one; it is `osascript` that wants arm64e.

The tool therefore drives the elected app and only that. This is a decision, not a gap.
