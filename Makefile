PREFIX ?= /usr/local
PURE := src/logic/time.js src/logic/seek.js src/logic/hold.js src/logic/stream.js src/logic/item.js src/logic/watch.js src/logic/paint.js src/logic/words.js src/logic/config.js
SOURCES := $(PURE) src/system/mediaremote.js src/system/files.js src/system/terminal.js src/player.js src/system/configfile.js src/watch.js src/dialects/nowplaying-cli.js src/dialects/media-control-help.js src/dialects/media-control-read.js src/dialects/media-control.js src/dialects/shared.js src/dialects/playerctl.js src/dialects/mpc.js src/dialects/shpotify.js src/dialects/index.js src/cli.js src/usage.js
TESTS := test/harness.js test/core.test.js test/hold.test.js test/item.test.js test/dialects.test.js test/paint.test.js test/watch.test.js test/edges.test.js test/edges-text.test.js test/config.test.js
TARGET := build/nowplayingseek
FAKE_TARGET := build/nowplayingseek-fake
TEST_TARGET := build/test.js

# JXA has no module system, so the sources are concatenated into the one file
# osascript runs. The order is the dependency order.
$(TARGET): $(SOURCES)
	@mkdir -p build
	{ echo '#!/usr/bin/osascript -l JavaScript'; cat $(SOURCES); } > $@
	chmod +x $@

.PHONY: build test test-live test-world lint install uninstall clean

build: $(TARGET)

# The same tool with a player that is a file, so that no test of arguments can reach a real one.
$(FAKE_TARGET): $(SOURCES) test/fake-mediaremote.js
	@mkdir -p build
	{ echo '#!/usr/bin/osascript -l JavaScript'; cat $(subst src/system/mediaremote.js,test/fake-mediaremote.js,$(SOURCES)); } > $@
	chmod +x $@

$(TEST_TARGET): $(TESTS)
	@mkdir -p build
	cat $(TESTS) > $@

test: $(TARGET) $(FAKE_TARGET) $(TEST_TARGET)
	osascript -l JavaScript $(TEST_TARGET) $(PURE)
	sh test/cli.test.sh $(FAKE_TARGET)
	sh test/fake.test.sh

# Opens VLC on generated silence and drives it; refuses while something is playing.
test-live: $(TARGET)
	sh test/live.test.sh $(TARGET)

# What we believe about VLC, QuickTime, macOS, Homebrew and nowplaying-cli, checked against them.
test-world: $(TARGET)
	sh test/world.test.sh $(TARGET)

lint:
	pre-commit run --all-files

install: $(TARGET)
	install -d $(DESTDIR)$(PREFIX)/bin
	install -m 755 $(TARGET) $(DESTDIR)$(PREFIX)/bin/nowplayingseek
	ln -sf nowplayingseek $(DESTDIR)$(PREFIX)/bin/nps

uninstall:
	rm -f $(DESTDIR)$(PREFIX)/bin/nowplayingseek $(DESTDIR)$(PREFIX)/bin/nps

clean:
	rm -rf build
