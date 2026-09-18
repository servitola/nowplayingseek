PREFIX ?= /usr/local
PURE := src/core.js src/config.js
SOURCES := $(PURE) src/mediaremote.js src/player.js src/cli.js
TESTS := test/harness.js test/core.test.js test/config.test.js
TARGET := build/nowplayingseek
TEST_TARGET := build/test.js

# JXA has no module system, so the sources are concatenated into the one file
# osascript runs. The order is the dependency order.
$(TARGET): $(SOURCES)
	@mkdir -p build
	{ echo '#!/usr/bin/osascript -l JavaScript'; cat $(SOURCES); } > $@
	chmod +x $@

.PHONY: build test lint install uninstall clean

build: $(TARGET)

$(TEST_TARGET): $(TESTS)
	@mkdir -p build
	cat $(TESTS) > $@

test: $(TARGET) $(TEST_TARGET)
	osascript -l JavaScript $(TEST_TARGET) $(PURE)
	sh test/cli.test.sh $(TARGET)

lint:
	pre-commit run --all-files

install: $(TARGET)
	install -d $(DESTDIR)$(PREFIX)/bin
	install -m 755 $(TARGET) $(DESTDIR)$(PREFIX)/bin/nowplayingseek

uninstall:
	rm -f $(DESTDIR)$(PREFIX)/bin/nowplayingseek

clean:
	rm -rf build
