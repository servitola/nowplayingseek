PREFIX ?= /usr/local
SOURCES := src/core.js src/mediaremote.js src/player.js src/cli.js
TARGET := build/nowplayingseek

# JXA has no module system, so the sources are concatenated into the one file
# osascript runs. The order is the dependency order.
$(TARGET): $(SOURCES)
	@mkdir -p build
	{ echo '#!/usr/bin/osascript -l JavaScript'; cat $(SOURCES); } > $@
	chmod +x $@

.PHONY: build test install uninstall clean

build: $(TARGET)

test: $(TARGET)
	osascript -l JavaScript test/core.test.js src/core.js
	$(TARGET) --version
	$(TARGET) --help > /dev/null

install: $(TARGET)
	install -d $(DESTDIR)$(PREFIX)/bin
	install -m 755 $(TARGET) $(DESTDIR)$(PREFIX)/bin/nowplayingseek

uninstall:
	rm -f $(DESTDIR)$(PREFIX)/bin/nowplayingseek

clean:
	rm -rf build
