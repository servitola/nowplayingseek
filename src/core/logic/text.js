const DEFAULT_COLUMNS = 80;
const ELLIPSIS = '…';
const STTY_SIZE = /^\d+ (\d+)\s*$/;
const ESCAPE_CHARACTER = 27;
const PAINT = new RegExp(`${String.fromCharCode(ESCAPE_CHARACTER)}\\[[0-9;]*m`, 'g');

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

// Phones and smart-quote editors turn a typed "--" into a dash, and a flag that starts with one
// was meant as "--"; a dash inside or at the end of an argument is left as it is.
const LEADING_DASH = /^[\u2013\u2014]/u;
const withPlainDashes = args => args.map(arg => arg.replace(LEADING_DASH, '--'));
