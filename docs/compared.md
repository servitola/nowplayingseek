# Compared with

[← README](../README.md)

<p align="center"><img src="banner-compared.webp" alt="Four dull remotes lie on the desk; the panda holds up a fifth, made of glowing glass" width="100%"></p>

| | nowplayingseek | [nowplaying-cli] | [media-control] | the player's own keys |
| --- | --- | --- | --- | --- |
| Seek by a step you choose | `forward 45`, `backward 5` | no, `seek` is absolute | fixed 15 s | fixed, differs per player |
| Works while another app has the focus | yes | yes | yes | no |
| Step grows while the key is held | `--progressive` | no | no | no |
| `12:34` as a time | yes | seconds only | seconds only | — |
| Metadata | everything macOS holds, as JSON; no artwork bytes | yes, with artwork | yes, with artwork | — |
| A stream of changes | `stream`, by polling | no | yes, pushed | — |
| Install | one script, personal tap | homebrew-core | homebrew-core | — |

If you need artwork or a stream of Now Playing updates for a status bar, take `media-control`.
This tool is for moving through what plays.

[nowplaying-cli]: https://github.com/kirtan-shah/nowplaying-cli
[media-control]: https://github.com/ungive/media-control
