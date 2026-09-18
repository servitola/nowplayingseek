# Development

[← README](../README.md)

<p align="center"><img src="images/banner-development.webp" alt="The panda tightens a bolt inside an opened glass player; three test lamps beside it glow green" width="100%"></p>

One script for `osascript`, no dependencies at run time. `make` concatenates `src/` into
`build/nowplayingseek`; there are no modules, so the order in the `Makefile` is the dependency order.

| | |
| --- | --- |
| `make build` | the tool, in `build/` |
| `make install PREFIX=~/.local` | the tool and its short name `nps` |
| `make test` | the logic under `osascript`, then every argument and the whole tool against a player that is a file. It cannot reach a real player |
| `make test-speed` | wall-clock time of each command against the fake player, min/median/max over 21 runs — the hotkey feels the median. Not part of `make test`: see below |
| `make test-live` | the real thing: VLC on generated silence. It refuses to start while something is playing |
| `make test-world` | what the project believes about VLC, QuickTime, macOS and Homebrew, checked against them |
| `make lint` | Biome with every stable rule as an error, shellcheck, shfmt, actionlint. Needs `pre-commit` and `node` |
| `make globals` | rewrites the lists in `biome.json` after a name starts to cross files |
| `make coverage` | lines of logic the unit tests never reach |
| `make typecheck` | TypeScript's checker over the built file |
| `make dist` | the release tarball in `dist/`: the script, the universal artwork bundle, LICENSE, README, and a `.sha256` beside it. What `.github/workflows/release.yml` runs on a pushed tag; [docs/install.md](install.md) is the reader-facing side |

`pre-commit install` once after cloning; commits go through the hook.

### Response time

The tool is bound to a hotkey, so startup latency is the product; `test/speed.test.sh`'s budgets
came from these, measured on the owner's M1 Max, macOS 26.6, 2026-09-19:

- The real build, `/usr/bin/time -p`, 3 runs each: `status --json` 0.08 s, `artwork <path>` 0.08 s,
  `get` 0.08 s, `get --no-artwork` 0.06 s.
- `make test-speed` against `build/nowplayingseek-fake`, 21 runs each, median: `--help` 63 ms,
  `status --json` 89 ms, `status` 71 ms, `get` 73 ms, `get --no-artwork` 69 ms, `artwork <path>`
  67 ms, `forward 5` 108 ms. The fake build runs a touch slower than the real one above — no perl,
  same JXA startup — so the script's own budgets sit at roughly 3x these, not the real-build numbers.

A machine or a macOS upgrade moves every number here at once; re-run `make test-speed` and update
both this section and the budgets in the script together, or a budget from 2026 keeps guarding
against a machine that no longer exists.

Layout, rules and dead ends that were measured and should not be retried:
[AGENTS.md](../AGENTS.md). What is left: [BACKLOG.md](../BACKLOG.md). What changed:
[CHANGELOG.md](../CHANGELOG.md).
