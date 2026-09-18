# When a release breaks half-way

A tag that Homebrew users may already have fetched is never moved or deleted: the formula pins
the tarball's sha256, and a re-tag changes it under everyone who installed. Fix forward with a
patch version instead. The one exception is a tag nobody could have installed — the formula was
never pushed — and even then deleting it is the owner's decision.

| Where it failed | State | What to do |
| --- | --- | --- |
| Source CI red on the pushed bump commit | no tag yet — Phase 4 tags only after green | Fix on `main` with a new commit and resume at Phase 4 step 1; the version stays. |
| Tag pushed, formula not updated | users still get the previous version | Nothing is broken. Resume at Phase 4 step 3. |
| `formula` step: tarball "is not there yet" | GitHub has not built the archive | Wait, retry. Check the tag exists: `git ls-remote origin refs/tags/v<version>`. |
| sha256 in the formula differs from a fresh download | formula would fail to install | Re-run `scripts/release.sh formula <version>`; it always takes the sha from the download. If it keeps changing, the tag was moved — stop and tell the owner. |
| `brew style` fails | formula not pushed | Fix the formula by hand, keep `url`/`sha256` as the script wrote them. |
| Tap commit pushed, mirror does not show it | GitHub mirror lags or the sync is down | Wait; the mirror is a cron-style sync, and anything pushed to GitHub directly is erased by its next force run. Tell the owner if the commit does not arrive. |
| Tap CI red on the formula commit | users who `brew update` get a broken formula | Read `gh run view <id> --log-failed`. If it is the formula: fix forward with a new tap commit. If the release itself is bad: a tap commit that restores the previous `url` and `sha256` (`git -C "$TAP_DIR" revert <commit>`), pushed with the owner's word, then a patch release. |
| Installed version misbehaves here | bad release is live | `brew uninstall nowplayingseek && brew install servitola/tap/nowplayingseek` after the tap revert above; hotkeys keep working because the path does not change. |
