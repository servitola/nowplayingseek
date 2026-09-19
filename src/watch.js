const REDRAW = `\r${ESCAPE}[K`;

// The last line is redrawn in place with a carriage return and nothing else: osascript cannot
// catch Ctrl-C, so the terminal must never be left in a state that needs undoing.
const watching = {
    write(text) {
        $.NSFileHandle.fileHandleWithStandardOutput.writeData($(text).dataUsingEncoding($.NSUTF8StringEncoding));
    },

    read() {
        const state = mediaRemote.read();
        return state && { ...state, at: now() };
    },

    status(state, columns) {
        if (!state) {
            return 'nothing is playing';
        }
        const chapter = formatChapter(mediaRemote.raw(state) || {});
        return paintStatus(state, { app: terminal.appName(state), multiplier: 1, chapter, columns });
    },

    painted({ live }) {
        let previous = this.read();
        let started = false;
        this.write(live ? this.status(previous, terminal.columns()) : `${this.status(previous)}\n`);
        while (!terminal.readerGone()) {
            delay(player.settings.watch.interval);
            const current = this.read();
            const change = describeChange(previous, current, started);
            const line = this.status(current, live ? terminal.columns() : undefined);
            if (change) {
                this.write(`${live ? REDRAW : ''}${paintChange(change, terminal.clock())}\n${live ? '' : `${line}\n`}`);
            }
            if (live) {
                this.write(REDRAW + line);
            }
            started = true;
            previous = current;
        }
    },

    plain() {
        let previous = this.read();
        let started = false;
        print(previous ? formatStatus(previous) : 'nothing is playing');
        while (!terminal.readerGone()) {
            delay(player.settings.watch.interval);
            const current = this.read();
            const change = describeChange(previous, current, started);
            if (change) {
                print(`${change.icon} ${change.words}${current ? `\n${formatStatus(current)}` : ''}`);
            }
            started = true;
            previous = current;
        }
    },

    run(view) {
        return terminal.colours() ? this.painted(view) : this.plain();
    },
};
