const BAR_CELLS = 16;
const ESCAPE_CODE = 27;
const ESCAPE = String.fromCharCode(ESCAPE_CODE);
const INK = { bold: 1, dim: 2, accent: 36, alarm: 31 };

const ink = (style, text) => `${ESCAPE}[${INK[style]}m${text}${ESCAPE}[0m`;

function paintedBar(position, duration) {
    const filled = Math.max(0, Math.min(BAR_CELLS, Math.round((position / duration) * BAR_CELLS)));
    return ink('accent', '━'.repeat(filled)) + ink('dim', '─'.repeat(BAR_CELLS - filled));
}

// For a terminal only. A pipe gets formatStatus, the line scripts already parse.
function paintStatus(state, { app, multiplier }) {
    const timed = state.duration > 0;
    const length = timed ? ink('dim', ` / ${formatTime(state.duration)}`) : '';
    const who = [state.title, state.artist].filter(Boolean);
    const parts = [
        `${ink('accent', state.playing ? '▶' : '⏸')} ${ink('bold', formatTime(state.position))}${length}`,
        timed ? paintedBar(state.position || 0, state.duration) : null,
        who.length > 0 ? [ink('bold', who[0]), ...who.slice(1)].join(' — ') : null,
        app ? ink('dim', `· ${app}`) : null,
        multiplier === 1 ? null : ink('accent', `×${multiplier}`),
    ];
    return parts.filter(Boolean).join('  ');
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
    return line === '' || line.includes(': ') ? line.replace(LABEL, label => ink('bold', label)) : ink('bold', line);
}

const paintUsage = text => text.split('\n').map(paintUsageLine).join('\n');

function paintIniLine(line) {
    if (line.startsWith(';') || line.startsWith('#')) {
        return ink('dim', line);
    }
    if (line.startsWith('[')) {
        return ink('bold', line);
    }
    return line.replace(INI_KEY, (_all, key, rest) => ink('accent', key) + rest);
}

const paintIni = text => text.split('\n').map(paintIniLine).join('\n');

function paintJsonValue(text) {
    if (text === 'null') {
        return ink('dim', text);
    }
    return JSON_NUMBER.test(text) || text === 'true' || text === 'false' ? ink('bold', text) : text;
}

function paintJson(value) {
    return JSON.stringify(value, null, 2)
        .split('\n')
        .map(line => {
            const [, indent, key, colon, rest, comma] = JSON_LINE.exec(line);
            const isKey = key !== undefined && colon !== undefined;
            const shown = isKey ? ink('accent', key) + colon + paintJsonValue(rest) : paintJsonValue((key || '') + rest);
            return indent + shown + comma;
        })
        .join('\n');
}

const paintError = text => ink('alarm', text);
