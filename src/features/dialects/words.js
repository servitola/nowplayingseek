const PLAYERCTL_POSITION = /^(\d+(?:\.\d+)?)([+-]?)$/;
const MPC_SEEK = /^([+-]?)(\d+(?::\d+){0,2}(?:\.\d+)?)(%?)$/;
const PLAYERCTL_FIELD = /\{\{\s*(?:(\w+)\(([^)]*)\)|([\w:]+))\s*\}\}/g;
const PLAYERCTL_LITERAL = /^("[^"]*"|\d+)$/;
const PERCENT = 100;

function clock(seconds) {
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / SECONDS_PER_MINUTE)}:${String(whole % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

function playerctlPosition(text) {
    const match = PLAYERCTL_POSITION.exec(text);
    if (!match) {
        return null;
    }
    const amount = Number.parseFloat(match[1]);
    return match[2] ? { by: match[2] === '+' ? amount : -amount } : { to: amount };
}

function mpcSeek(text, duration) {
    const match = MPC_SEEK.exec(text);
    if (!match) {
        return null;
    }
    const [, sign, number, percent] = match;
    if (percent && !(duration > 0)) {
        return null;
    }
    const amount = percent ? (Number.parseFloat(number) / PERCENT) * duration : parseTime(number);
    if (isMissing(amount)) {
        return null;
    }
    return sign ? { by: sign === '+' ? amount : -amount } : { to: amount };
}

const STATUS_EMOJI = new Map([
    ['Playing', '▶️'],
    ['Paused', '⏸️'],
    ['Stopped', '⏹️'],
]);
const PLAYERCTL_HELPERS = {
    duration: micros => clock(micros / MICROSECONDS),
    lc: text => String(text).toLowerCase(),
    uc: text => String(text).toUpperCase(),
    trunc: (text, length) => (String(text).length > length ? `${String(text).slice(0, length)}…` : String(text)),
    default: (value, otherwise) => (value === '' ? otherwise : value),
    emoji: status => STATUS_EMOJI.get(status) || String(status),
    markup_escape: text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
};
const UNFILLABLE = ['volume', 'shuffle', 'loop'];

function playerctlValue(text, fields) {
    const word = text.trim();
    if (PLAYERCTL_LITERAL.test(word)) {
        return JSON.parse(word);
    }
    if (UNFILLABLE.includes(word)) {
        throw new Failure(EXIT.usage, `playerctl's {{ ${word} }} has nothing behind it here: Now Playing knows no ${word}`);
    }
    return isMissing(fields[word]) ? '' : fields[word];
}

function playerctlFormat(template, fields) {
    return template.replace(PLAYERCTL_FIELD, (_whole, helper, argumentList, name) => {
        if (!helper) {
            return String(playerctlValue(name, fields));
        }
        if (!Object.hasOwn(PLAYERCTL_HELPERS, helper)) {
            throw new Failure(EXIT.usage, `nowplayingseek does not know the helper ${helper}() of playerctl's format strings`);
        }
        const values = argumentList.split(',').map(part => playerctlValue(part, fields));
        return String(PLAYERCTL_HELPERS[helper](...values));
    });
}
