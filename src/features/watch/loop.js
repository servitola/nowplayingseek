const REDRAW = `\r${ESCAPE}[K`;
// Some terminals draw ▶ and ⏸ two cells wide, and nothing tells us which. A line that reaches the
// edge wraps, the carriage return then clears only its last row, and the rest stays on the screen.
const EDGE_MARGIN = 4;

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

    log(changes, state) {
        const app = state && terminal.appName(state);
        return changes.map(change => `${paintChange(change, terminal.clock(), state, app)}\n`).join('');
    },

    opening(state) {
        return state
            ? this.log(logOf({ icon: '♪', words: named(state) }, state), state)
            : `${ink('dim', terminal.clock())}  nothing is playing\n`;
    },

    painted({ live }) {
        let previous = this.read();
        let started = false;
        this.write(live ? this.status(previous, terminal.columns() - EDGE_MARGIN) : this.opening(previous));
        while (!terminal.readerGone()) {
            delay(player.settings.watch.interval);
            const current = this.read();
            const change = describeChange(previous, current, started);
            if (change) {
                this.write((live ? REDRAW : '') + this.log(logOf(change, current), current));
            }
            if (live) {
                this.write(REDRAW + this.status(current, terminal.columns() - EDGE_MARGIN));
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

// core's status.js checks RENDERERS.watch, never this file by name, and falls back to the plain
// JSON stream when nothing has registered — AGENTS.md's core/feature rule.
RENDERERS.watch = view => watching.run(view);
COMMANDS.watch = () => RENDERERS.watch({ live: true });
