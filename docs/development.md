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
| `make test-live` | the real thing: VLC on generated silence. It refuses to start while something is playing |
| `make test-world` | what the project believes about VLC, QuickTime, macOS and Homebrew, checked against them |
| `make lint` | Biome with every stable rule as an error, shellcheck, shfmt, actionlint. Needs `pre-commit` and `node` |
| `make globals` | rewrites the lists in `biome.json` after a name starts to cross files |
| `make coverage` | lines of logic the unit tests never reach |
| `make typecheck` | TypeScript's checker over the built file |

`pre-commit install` once after cloning; commits go through the hook.

Layout, rules and dead ends that were measured and should not be retried:
[AGENTS.md](../AGENTS.md). What is left: [BACKLOG.md](../BACKLOG.md). What changed:
[CHANGELOG.md](../CHANGELOG.md).
