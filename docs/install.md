# Install without Homebrew

[← README](../README.md)

[Homebrew](../README.md#install) stays the easier path when it is on the machine — it also
upgrades the tool. Without it: download the release tarball, check it, unpack it.

```sh
version=2026.09.20
base=https://github.com/servitola/nowplayingseek/releases/download/v$version
curl -fsSLO "$base/nowplayingseek-$version-macos.tar.gz"
curl -fsSLO "$base/nowplayingseek-$version-macos.tar.gz.sha256"
shasum -a 256 -c "nowplayingseek-$version-macos.tar.gz.sha256"
tar -xzf "nowplayingseek-$version-macos.tar.gz"
```

That unpacks one folder: `nowplayingseek`, its short name `nps`, the compiled artwork helper
`nowplayingseek-artwork.bundle`, `LICENSE`, `README.md`. The tool finds the helper next to
itself, wherever that is. Move the first three onto `PATH`:

```sh
install -d ~/.local/bin
cd "nowplayingseek-$version-macos"
install -m 755 nowplayingseek nowplayingseek-artwork.bundle ~/.local/bin/
ln -sf nowplayingseek ~/.local/bin/nps
```

One tarball for both kinds of Mac: the bundle inside is built `-arch arm64 -arch x86_64`, so
there is nothing to pick between Intel and Apple Silicon.

With the GitHub CLI, `gh attestation verify nowplayingseek-$version-macos.tar.gz --owner
servitola` checks the file was built by this repository's own CI on the tag it claims, not
swapped in afterwards.

This copy does not update itself — a new version means running the four lines above again with
the new `version`. `docs/development.md` covers building the same tarball from a checkout.
