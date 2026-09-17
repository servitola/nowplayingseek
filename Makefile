PREFIX ?= /usr/local
PURE := src/logic/time.js src/logic/seek.js src/logic/hold.js src/logic/stream.js src/logic/item.js src/logic/watch.js src/logic/paint.js src/logic/words.js src/logic/config.js
SOURCES := $(PURE) src/system/mediaremote.js src/system/paths.js src/system/artwork.js src/system/files.js src/system/terminal.js src/player.js src/system/configfile.js src/watch.js src/dialects/nowplaying-cli.js src/dialects/media-control-help.js src/dialects/media-control-read.js src/dialects/media-control.js src/dialects/shared.js src/dialects/playerctl.js src/dialects/mpc.js src/dialects/shpotify.js src/dialects/index.js src/output.js src/args.js src/cli.js src/usage.js
TESTS := test/harness.js test/core.test.js test/hold.test.js test/item.test.js test/dialects.test.js test/paint.test.js test/watch.test.js test/edges.test.js test/edges-text.test.js test/config.test.js
TARGET := build/nowplayingseek
FAKE_TARGET := build/nowplayingseek-fake
TEST_TARGET := build/test.js
ARTWORK_SRC := native/artwork.m
ARTWORK_BUNDLE := build/nowplayingseek-artwork.bundle

# JXA has no module system, so the sources are concatenated into the one file
# osascript runs. The order is the dependency order.
$(TARGET): $(SOURCES)
	@mkdir -p build
	{ echo '#!/usr/bin/osascript -l JavaScript'; cat $(SOURCES); } > $@
	chmod +x $@

.PHONY: build test test-speed test-live test-world coverage typecheck globals lint install uninstall clean

build: $(TARGET) $(ARTWORK_BUNDLE)

# The same tool with a player that is a file, so that no test of arguments — nor artwork —
# can reach anything real.
FAKE_SOURCES := $(subst src/system/artwork.js,test/fake-artwork.js,$(subst src/system/mediaremote.js,test/fake-mediaremote.js,$(SOURCES)))
$(FAKE_TARGET): $(SOURCES) test/fake-mediaremote.js test/fake-artwork.js
	@mkdir -p build
	{ echo '#!/usr/bin/osascript -l JavaScript'; cat $(FAKE_SOURCES); } > $@
	chmod +x $@

$(TEST_TARGET): $(TESTS)
	@mkdir -p build
	cat $(TESTS) > $@

# A real Objective-C block, which nothing inside osascript can build (docs/how-it-works.md);
# loaded into /usr/bin/perl at run time by artwork.fetch() in src/system/artwork.js.
# Unsigned is fine: mediaremoted checks perl's own code signature, never this file's.
$(ARTWORK_BUNDLE): $(ARTWORK_SRC)
	@mkdir -p build
	clang -fobjc-arc -Wall -Wextra -bundle -framework Foundation -o $@ $<

test: $(TARGET) $(FAKE_TARGET) $(TEST_TARGET) $(ARTWORK_BUNDLE)
	osascript -l JavaScript $(TEST_TARGET) $(PURE)
	sh test/cli.test.sh $(FAKE_TARGET)
	sh test/fake.test.sh

# Not part of `test`: wall-clock budgets are noise on a shared, loaded CI runner.
test-speed: $(FAKE_TARGET)
	sh test/speed.test.sh $(FAKE_TARGET)

# Opens VLC on generated silence and drives it; refuses while something is playing.
test-live: $(TARGET)
	sh test/live.test.sh $(TARGET)

# What we believe about VLC, QuickTime, macOS, Homebrew and nowplaying-cli, checked against them.
# Not strict: the sources carry no annotations, so this finds a wrong name, a wrong count of
# arguments, a property nothing has — not an implicit any. For development; CI does not run it.
typecheck: $(TARGET)
	@mkdir -p build/types
	tail -n +2 $(TARGET) > build/types/nowplayingseek.js
	npx -y -p typescript@7.0.2 tsc --allowJs --checkJs --noEmit --target es2023 --lib es2023 --strict false build/types/nowplayingseek.js scripts/jxa.d.ts

coverage:
	node scripts/coverage.js "$(PURE)" "$(TESTS)"

test-world: $(TARGET)
	sh test/world.test.sh $(TARGET)

globals:
	node scripts/globals.js
	pre-commit run biome-check --files biome.json || true

lint:
	node scripts/globals.js --check
	pre-commit run --all-files

install: $(TARGET) $(ARTWORK_BUNDLE)
	install -d $(DESTDIR)$(PREFIX)/bin
	install -m 755 $(TARGET) $(DESTDIR)$(PREFIX)/bin/nowplayingseek
	install -m 755 $(ARTWORK_BUNDLE) $(DESTDIR)$(PREFIX)/bin/nowplayingseek-artwork.bundle
	ln -sf nowplayingseek $(DESTDIR)$(PREFIX)/bin/nps

uninstall:
	rm -f $(DESTDIR)$(PREFIX)/bin/nowplayingseek $(DESTDIR)$(PREFIX)/bin/nps $(DESTDIR)$(PREFIX)/bin/nowplayingseek-artwork.bundle

clean:
	rm -rf build
