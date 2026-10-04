# Install without Homebrew

[← README](../README.md)

For a Mac that has no Homebrew and is not getting one. If `brew` is there, use
[the one line in the README](../README.md#install) instead: it also upgrades the tool, this way
does not.

Three steps in Terminal, a minute in all. Nothing needs `sudo`.

## 1. Download

```sh
latest=https://github.com/servitola/nowplayingseek/releases/latest
version=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "$latest" | sed 's|.*/v||')
base=https://github.com/servitola/nowplayingseek/releases/download/v$version
curl -fsSLO "$base/nowplayingseek-$version-macos.tar.gz"
curl -fsSLO "$base/nowplayingseek-$version-macos.tar.gz.sha256"
shasum -a 256 -c "nowplayingseek-$version-macos.tar.gz.sha256"
```

The last line must answer `OK`: the file arrived whole. Anything else — stop and download again.

## 2. Put it in place

```sh
tar -xzf "nowplayingseek-$version-macos.tar.gz"
cd "nowplayingseek-$version-macos"
install -d ~/.local/bin
install -m 755 nowplayingseek nowplayingseek-artwork.bundle ~/.local/bin/
ln -sf nowplayingseek ~/.local/bin/nps
```

Two files and a short name: the tool, the helper that reads cover art, and `nps`. The helper has
to sit next to the tool. The same files serve Intel and Apple Silicon.

## 3. Check

```sh
~/.local/bin/nowplayingseek --version
```

It prints the version. To call it as plain `nowplayingseek`, the folder has to be on `PATH` —
on a fresh Mac it is not:

```sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

Open a new Terminal window after that. In Shortcuts, Karabiner and other apps that run commands,
write the full path `~/.local/bin/nowplayingseek` — they do not read `.zshrc`.

## Later

- **Update** — run steps 1 and 2 again; they fetch the newest release and overwrite the old one.
- **Remove** — `rm ~/.local/bin/{nowplayingseek,nps,nowplayingseek-artwork.bundle}`.
- **Check where the file came from** (optional, needs the GitHub CLI) —
  `gh attestation verify nowplayingseek-$version-macos.tar.gz --owner servitola` confirms it was
  built by this repository's CI from the tag it names.
- **Build it yourself** — [docs/development.md](development.md).
