const BAR_CELLS = 16;
const ESCAPE_CODE = 27;
const ESCAPE = String.fromCharCode(ESCAPE_CODE);
// The sixteen colours of the terminal, never an RGB of our own: the reader's theme decides what
// green is. Playing is green and paused is yellow everywhere; a string, a number and a flag in
// JSON differ the way they do in an editor.
const INK = {
    bold: 1,
    dim: 2,
    alarm: 31,
    playing: 32,
    paused: 33,
    number: 33,
    heading: 33,
    place: 34,
    key: 34,
    flag: 35,
    string: 32,
    accent: 36,
};
const EVENT_INK = { '▶': 'playing', '⏸': 'paused', '⇥': 'place', '♪': 'flag', '×': 'alarm' };

const ink = (style, text) => `${ESCAPE}[${INK[style]}m${text}${ESCAPE}[0m`;

const stateInk = state => (state.playing ? 'playing' : 'paused');

function paintedBar(state) {
    const filled = Math.max(0, Math.min(BAR_CELLS, Math.round(((state.position || 0) / state.duration) * BAR_CELLS)));
    return ink(stateInk(state), '━'.repeat(filled)) + ink('dim', '─'.repeat(BAR_CELLS - filled));
}

// For a terminal only. A pipe gets formatStatus, the line scripts already parse.
function paintStatusParts(state, { app, multiplier, chapter }) {
    const timed = state.duration > 0;
    const length = timed ? ink('dim', ` / ${formatTime(state.duration)}`) : '';
    const who = [state.title, state.artist].filter(Boolean);
    const parts = [
        `${ink(stateInk(state), state.playing ? '▶' : '⏸')} ${ink('bold', formatTime(state.position))}${length}`,
        timed ? paintedBar(state) : null,
        who.length > 0 ? [ink('bold', who[0]), ...who.slice(1)].join(' — ') : null,
        chapter ? ink('accent', `ch ${chapter}`) : null,
        app ? ink('dim', `· ${app}`) : null,
        multiplier === 1 ? null : ink('number', `×${multiplier}`),
    ];
    return parts.filter(Boolean).join('  ');
}

// A title too long for the terminal is cut, so that a line redrawn in place never wraps.
function paintStatus(state, options) {
    const line = paintStatusParts(state, options);
    const over = options.columns ? visibleLength(line) - options.columns : 0;
    if (over <= 0 || !state.title) {
        return line;
    }
    const room = Math.max(1, Array.from(state.title).length - over);
    return paintStatusParts({ ...state, title: fitToWidth(state.title, room) }, options);
}

const LABEL_WIDTH = 7;

// One line of the log. A play, a pause or a seek says where it happened, so the line stands alone.
function paintChange(change, clock, state, app) {
    const when = ink('dim', clock);
    if (!(change.label && state)) {
        return `${when}  ${ink(EVENT_INK[change.icon], change.icon)} ${ink('bold', change.words)}${app ? ink('dim', `  · ${app}`) : ''}`;
    }
    const timed = state.duration > 0;
    const where = ink('bold', formatTime(state.position)) + (timed ? ink('dim', ` / ${formatTime(state.duration)}`) : '');
    const what = ink(EVENT_INK[change.icon], `${change.icon} ${change.label.padEnd(LABEL_WIDTH)}`);
    return [`${when}  ${what}`, where, timed ? paintedBar(state) : null].filter(Boolean).join('  ');
}

const NOTE_INDENT = '    ';
const USAGE_ENTRY = /^( {2})(\S.*?)( {2,}.*)?$/;
const WORD = /\S+/g;
const LABEL = /^[^:]+:/;
const USAGE_ARGUMENT = /(<[^>]*>|\[[^\]]*\]|\|)/;
const TITLE = /^(\S+ \S+)(.*)$/;
const INI_KEY = /^([^=;[\s][^=]*?)( *=.*)$/;
const JSON_LINE = /^(\s*)("(?:[^"\\]|\\.)*")?(: )?(.*?)(,?)$/;
const JSON_NUMBER = /^-?\d/;

const paintWords = words =>
    words
        .split(USAGE_ARGUMENT)
        .map(part => (USAGE_ARGUMENT.test(part) ? ink('dim', part) : part.replace(WORD, word => ink('accent', word))))
        .join('');

function paintUsageLine(line, index) {
    if (index === 0) {
        return line.replace(TITLE, (_all, name, rest) => ink('bold', name) + ink('dim', rest));
    }
    if (line.startsWith(NOTE_INDENT)) {
        return ink('dim', line);
    }
    const entry = USAGE_ENTRY.exec(line);
    if (entry) {
        return entry[1] + paintWords(entry[2]) + (entry[3] || '');
    }
    return line === '' || line.includes(': ') ? line.replace(LABEL, label => ink('bold', label)) : ink('heading', line);
}

const paintUsage = text => text.split('\n').map(paintUsageLine).join('\n');

function paintIniLine(line) {
    if (line.startsWith(';') || line.startsWith('#')) {
        return ink('dim', line);
    }
    if (line.startsWith('[')) {
        return ink('heading', line);
    }
    return line.replace(INI_KEY, (_all, key, rest) => ink('accent', key) + rest);
}

const paintIni = text => text.split('\n').map(paintIniLine).join('\n');

function paintJsonValue(text) {
    if (text === 'null') {
        return ink('dim', text);
    }
    if (text === 'true' || text === 'false') {
        return ink('flag', text);
    }
    if (JSON_NUMBER.test(text)) {
        return ink('number', text);
    }
    return text.startsWith('"') ? ink('string', text) : text;
}

function paintJson(value) {
    return JSON.stringify(value, null, 2)
        .split('\n')
        .map(line => {
            const [, indent, key, colon, rest, comma] = JSON_LINE.exec(line);
            const isKey = key !== undefined && colon !== undefined;
            return indent + (isKey ? ink('key', key) + colon + paintJsonValue(rest) : paintJsonValue((key || '') + rest)) + comma;
        })
        .join('\n');
}

const paintError = text => ink('alarm', text);
