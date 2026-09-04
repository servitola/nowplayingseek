const IDENTITY = ['title', 'artist', 'album', 'app'];
const LEAP = 2;
const DEFAULT_COLUMNS = 80;
const ELLIPSIS = '…';
const STTY_SIZE = /^\d+ (\d+)\s*$/;
const ESCAPE_CHARACTER = 27;
const PAINT = new RegExp(`${String.fromCharCode(ESCAPE_CHARACTER)}\\[[0-9;]*m`, 'g');

const named = state => [state.title, state.artist].filter(Boolean).join(' — ');

// What happened between two reads, in a word — or nothing, when the item merely played on.
function describeChange(previous, current, started = false) {
    if (!current) {
        return previous ? { icon: '×', words: 'nothing is playing' } : null;
    }
    if (!previous) {
        return started ? { icon: '♪', words: named(current) } : null;
    }
    if (IDENTITY.some(key => previous[key] !== current[key])) {
        return { icon: '♪', words: named(current) };
    }
    if (previous.playing !== current.playing) {
        return current.playing ? { icon: '▶', words: 'played' } : { icon: '⏸', words: 'paused' };
    }
    const expected = previous.position + (previous.rate || 0) * (current.at - previous.at);
    return Math.abs(current.position - expected) > LEAP ? { icon: '⇥', words: `seeked to ${formatTime(current.position)}` } : null;
}

function fitToWidth(text, columns) {
    const characters = Array.from(text);
    if (characters.length <= columns) {
        return text;
    }
    return columns > 0 ? characters.slice(0, columns - 1).join('') + ELLIPSIS : '';
}

function parseColumns(sttySize) {
    const match = STTY_SIZE.exec(sttySize);
    return match ? Number.parseInt(match[1], 10) : DEFAULT_COLUMNS;
}

const visibleLength = text => Array.from(text.replace(PAINT, '')).length;
