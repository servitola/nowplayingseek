const PLAYERCTL_POSITION = /^(\d+(?:\.\d+)?)([+-]?)$/;
const MPC_SEEK = /^([+-]?)(\d+(?::\d+){0,2}(?:\.\d+)?)(%?)$/;
const PLAYERCTL_FIELD = /\{\{\s*(?:(\w+)\(\s*([\w:]+)\s*\)|([\w:]+))\s*\}\}/g;
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

function playerctlFormat(template, fields) {
    const helpers = {
        duration: micros => clock(micros / MICROSECONDS),
        lc: text => String(text).toLowerCase(),
        uc: text => String(text).toUpperCase(),
    };
    return template.replace(PLAYERCTL_FIELD, (_whole, helper, argument, name) => {
        const value = fields[argument || name];
        if (isMissing(value)) {
            return '';
        }
        return helper && Object.hasOwn(helpers, helper) ? helpers[helper](value) : String(value);
    });
}
