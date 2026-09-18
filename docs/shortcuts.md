# A keyboard shortcut, with the Shortcuts app

[← README](../README.md)

This page is for someone who has never opened Terminal. Every step is in the
Shortcuts app, which is already on your Mac — nothing else to install except
the one command below. Follow the numbers in order; do not skip ahead.

At the end: press a key combination of your choice, anywhere on your Mac, and
whatever is playing — a browser tab, IINA, VLC, Music, Spotify — jumps forward
or back ten seconds.

## The short way: install both, ready-made

These two open in Shortcuts and install with one click:

| | |
| --- | --- |
| [Seek forward 10 s](https://www.icloud.com/shortcuts/9dffdfbe348a4eb88d19f50011ffec7c) | jumps ten seconds ahead |
| [Seek backward 10 s](https://www.icloud.com/shortcuts/49f7273113be46f7a5ec3f1d28dc20e8) | jumps ten seconds back |

They still need the tool itself (step 1) and scripting turned on (step 3),
and they carry the Apple silicon path — on an Intel Mac, open each one and
change `/opt/homebrew/` to `/usr/local/`. Assigning the keys is step 4.
Building them by hand instead takes about five minutes.

## 1. Install the tool

Open **Terminal** (press `⌘ Space`, type `Terminal`, press `Return`) and paste
this line, then press `Return`:

```sh
brew install servitola/tap/nowplayingseek
```

If Terminal answers `zsh: command not found: brew`, Homebrew itself is not on
this Mac yet. Go to [brew.sh](https://brew.sh), copy the one line under
"Install Homebrew", paste it into Terminal, press `Return`, and follow what it
prints. Then run the `brew install` line above again.

Once that finishes, check it worked. In the same Terminal window, run:

```sh
nowplayingseek status
```

- If something is playing, you see a line with the title and how far in it
  is — for example `▶ 30:57 / 3:15:50  Some Title  (com.some.app)`. The tool
  is installed.
- If nothing is playing right now, you instead see `nowplayingseek: nothing
  is playing` — that is also a pass: the tool ran and answered. Play
  something anywhere and run the command again to see the first kind of
  answer.
- If you see `zsh: command not found: nowplayingseek`, the install did not
  finish, or finished with a warning. Scroll up in Terminal and read what
  `brew install` printed; re-run it if a step failed partway.

Keep Terminal open — the next step needs it too.

### The one detail Shortcuts needs spelled out

Shortcuts does not know where `nowplayingseek` lives, so typing
`nowplayingseek forward 10` into Shortcuts will not work — you must give it
the full path. Find yours by running, in Terminal:

```sh
which nowplayingseek
```

- On a Mac with an Apple silicon chip (M1, M2, M3, M4 …), this prints
  `/opt/homebrew/bin/nowplayingseek`.
- On an older, Intel Mac, it prints `/usr/local/bin/nowplayingseek`.

Whichever line it prints — that is the exact text you paste into Shortcuts in
step 2 below, in front of `forward 10` or `backward 10`.

## 2. Make the "forward" shortcut

![The Shortcuts app window with the New Shortcut button circled in the
toolbar](images/shortcuts-01-new-shortcut.webp)

1. Open **Shortcuts** (press `⌘ Space`, type `Shortcuts`, press `Return`).
2. Click the **+** button in the toolbar. A new, empty shortcut opens.
3. Click where it says **Shortcut Name** at the top and type `Seek forward 10 s`.

![Searching for the Run Shell Script action in the Shortcuts action
picker](images/shortcuts-02-search-run-shell-script.webp)

4. On the right, click the search field and type `shell`. Double-click
   **Run Shell Script** in the list that appears — it drops into your
   shortcut.

![The Run Shell Script action with the nowplayingseek command pasted into
its text box](images/shortcuts-03-run-shell-script-filled.webp)

5. Click inside the **Run Shell Script** box and delete anything already
   there. Paste the line you built in step 1 — the full path, a space, then
   `forward 10`. It should look like one of these two, never both:

   ```sh
   /opt/homebrew/bin/nowplayingseek forward 10
   ```

   ```sh
   /usr/local/bin/nowplayingseek forward 10
   ```

6. Close the shortcut editor window. `Seek forward 10 s` now appears in your list
   of shortcuts.

## 3. Try it once

![The Run Shell Script action refusing to run until scripting is allowed](images/shortcuts-04-scripting-disabled.webp)

Play something — a YouTube video, a song, anything — then click the **▶**
button at the top of the editor window.

The first time, nothing runs: the action itself says *"This action cannot
be run because scripting actions are disabled"* and offers **Open
Preferences**. Click it, tick **Allow Running Scripts** (the next
screenshot), close that window, and press **▶** again. The video or song
jumps ten seconds ahead.

If it does not, do not keep clicking — read "What can go wrong" further
down first.

## 4. Give it a keyboard shortcut

![The details pane of a shortcut with Add Keyboard Shortcut
highlighted](images/shortcuts-06-add-keyboard-shortcut.webp)

1. Double-click `Seek forward 10 s` in the list to open it again.
2. Click the details icon — a small circled **i** — near the top of the
   editor window.
3. Click **Add Keyboard Shortcut**.
4. The panel grows a **Run with:** box, waiting. Press the combination you
   want. `⌃⌥⇧K` (Control + Option + Shift + K) is a safe one — it was used
   to test this page. Avoid `⌃⌥←` and `⌃⌥→`: window managers like
   Rectangle and Magnet take those by default.
5. macOS ticks **Use as Quick Action** and **Services Menu** by itself at
   this point. That is how a key reaches a shortcut; leave them on.
6. Close the editor window. There is no save button — it is already saved.

Apple's own instructions for this step are at [Run a shortcut from a
keyboard shortcut](https://support.apple.com/guide/shortcuts-mac/run-a-shortcut-from-another-app-apd163eb9f95/mac)
(look for "Set up a keyboard shortcut").

Try the key combination anywhere — a browser, a text editor, the Finder. If
something is playing, it should jump forward ten seconds.

## 5. Repeat for "backward"

The fastest way is to copy what you already built:

1. In the Shortcuts list, right-click `Seek forward 10 s` and choose **Duplicate**.
2. Rename the copy `Seek backward 10 s`.
3. Open it, click into the **Run Shell Script** box, and change `forward` to
   `backward` — the path stays the same:

   ```sh
   /opt/homebrew/bin/nowplayingseek backward 10
   ```

4. Give it its own keyboard shortcut the same way as step 4 — `⌃⌥⇧J` sits
   next to `⌃⌥⇧K` on the keyboard and was tested with it.

![Both shortcuts in the Shortcuts library](images/shortcuts-07-both-shortcuts.webp)

You now have two keys: one moves forward, one moves back.

## What can go wrong

**"This action cannot be run because scripting actions are disabled."**
Shortcuts blocks every script action until you allow them once. Click
**Open Preferences** in the action itself, or go to the Shortcuts menu →
**Settings…** → **Advanced**, and turn on **Allow Running Scripts**. Run
the shortcut again.

![The Allow Running Scripts toggle turned on in Shortcuts
Settings](images/shortcuts-05-allow-running-scripts.webp)

**Nothing happens, and the shortcut finishes instantly with no error.**
Most likely the path is wrong. Open Terminal, run `which nowplayingseek`
again (step 1), and make sure the box in **Run Shell Script** starts with
exactly that path — not `nowplayingseek` on its own, and not a path that
does not match what `which` printed.

**The shortcut runs but nothing on screen moves, and Terminal-style text
like "nothing is playing" would explain it.**
This is exit code 1 from the tool: nothing is playing anywhere on the Mac. Start playing something first, then run the shortcut or press the
key again.

**The video or song does not move, but something is playing.**
This is exit code 2: the app that is playing does not support seeking by
command — most commonly a web page that does not implement it. Try it on a
YouTube tab, which does support it, to confirm the shortcut itself is
correct.

**Pressing the key combination does something else, or nothing at all.**
Another app already uses that combination — macOS gives the older
assignment priority. Pick a combination you have not used before (avoid
single arrow keys, `⌘`-something, and function keys already tied to
brightness or volume). Some combinations are reserved by macOS itself and
cannot be reassigned to anything.

**Shortcuts says the key combination is already taken.**
Choose a different one, or first remove it from whichever app or System
Settings shortcut is using it, then assign it here.

## Ask an AI assistant to do this for you

If you would rather not do the above by hand, copy the block below and
paste it, as it is, into any AI assistant running on your Mac — for
example ChatGPT's desktop app, Claude, or a similar tool that can run
commands for you. Say "do this on my Mac" and let it work through the
steps, checking each one before moving to the next.

```text
Set up a macOS keyboard shortcut that seeks whatever is playing
(a browser tab, IINA, VLC, Music, Spotify) forward and back 10
seconds, using a command-line tool called nowplayingseek and the
built-in Shortcuts app. I have never used Terminal before, so
explain and verify every step before moving to the next one.

1. Check whether Homebrew is installed: run `brew --version`.
   If it is missing, tell me to install it from https://brew.sh
   and wait for me to confirm before continuing.

2. Install the tool:
   brew install servitola/tap/nowplayingseek

3. Verify the install by running:
   nowplayingseek status
   A working install either prints a line with a title and a
   position, or prints "nothing is playing" - both mean success.
   A "command not found" error means the install failed; stop
   and tell me what `brew install` printed instead.

4. Run `which nowplayingseek` and remember the full path it
   prints (it will be /opt/homebrew/bin/nowplayingseek on Apple
   silicon, or /usr/local/bin/nowplayingseek on an Intel Mac).

5. Open the Shortcuts app for me and guide me, step by step, to:
   - create a shortcut named "Seek forward 10 s" with one action,
     "Run Shell Script", whose script box contains exactly
     "<full path from step 4> forward 10"
   - assign it a keyboard shortcut via its details pane
     ("Add Keyboard Shortcut")
   - duplicate it as "Seek backward 10 s", change "forward 10" to
     "backward 10" in the script box, and give it its own
     keyboard shortcut

   You cannot click inside the Shortcuts app yourself - tell me
   exactly what to click, wait for me to say it is done, and
   only then move to the next instruction.

6. If Shortcuts asks to "Allow Running Scripts", tell me to find
   that toggle under Shortcuts > Settings > Advanced and turn it
   on, then try again.

7. After both shortcuts exist, ask me to test each key
   combination while something is playing, and confirm out loud
   whether it moved forward or back.
```

## More

[Karabiner-Elements, Hammerspoon, skhd and other tools →](hotkeys.md)
