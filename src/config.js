const NUMBER_PATTERN = /^\d+(\.\d+)?$/;
const PATTERN_POINT = /^(\d+(?:\.\d+)?)s?\s*:\s*x?(\d+(?:\.\d+)?)$/i;
const LINE_BREAK = /\r?\n/;
const INI_SECTION = /^\[([^\]]+)\]$/;
const INI_PAIR = /^([^=]+)=(.*)$/;

const positive = parse => text => {
    const value = parse(text);
    return value > 0 ? value : null;
};

const parseNumber = text => (NUMBER_PATTERN.test(text) ? Number.parseFloat(text) : null);

const SETTINGS = {
    seek: {
        step: {
            text: '10',
            parse: positive(parseTime),
            expects: 'seconds or mm:ss above zero',
            about: 'forward / backward without a time',
        },
    },
    progressive: {
        pattern: {
            text: '5s:x2, 10s:x3, ...',
            parse: parsePattern,
            expects: '"<held seconds>:<multiplier>" points in ascending order, optionally ending with "..."',
            about:
                'forward / backward --progressive: once the key has been held this long, the step is multiplied.\n'
                + 'A trailing "..." keeps going at the pace of the last two points: 15s:x4, 20s:x5 and so on.',
        },
        max_multiplier: { text: '10', parse: positive(parseNumber), expects: 'a number above zero', about: 'where "..." stops growing' },
        streak_gap: {
            text: '1',
            parse: positive(parseNumber),
            expects: 'seconds above zero',
            about: 'presses in one direction no further apart than this count as one hold',
        },
    },
    hold: {
        interval: {
            text: '0.25',
            parse: positive(parseNumber),
            expects: 'seconds above zero',
            about: 'forward / backward --hold: pause between steps while the key is down',
        },
        max_time: {
            text: '30',
            parse: positive(parseNumber),
            expects: 'seconds above zero',
            about: 'a --hold stops by itself after this long, in case the release never arrives',
        },
    },
    timing: {
        verify_timeout: {
            text: '2.5',
            parse: positive(parseNumber),
            expects: 'seconds above zero',
            about: 'how long to wait for the player to do what was asked before exit 2',
        },
        // A seek shows up in Now Playing 50–150 ms after the call, and over a second when a web
        // page has to buffer (measured: Vivaldi + YouTube, macOS 26.6). Key repeat is faster
        // than that, so until Now Playing refreshes, a held hotkey must build on the previous
        // target instead of the stale position. The cap stops a player that ignores seeks from
        // accumulating targets forever.
        pending_seek_max: {
            text: '3',
            parse: positive(parseNumber),
            expects: 'seconds above zero',
            about: 'how long a held key keeps building on its previous target while Now Playing has not refreshed',
        },
        // MRMediaRemoteSendCommand returns true and hands the message to XPC asynchronously: a
        // process that exits right away never delivers it (measured: pause with no linger did
        // nothing, with 0.3 s it paused). next/previous have no state to poll for, so they linger.
        command_delivery: {
            text: '0.3',
            parse: positive(parseNumber),
            expects: 'seconds above zero',
            about: 'how long next / previous linger so the command is delivered before the process exits',
        },
        poll_interval: {
            text: '0.03',
            parse: positive(parseNumber),
            expects: 'seconds above zero',
            about: 'pause between Now Playing reads while waiting',
        },
    },
};

function parsePattern(text) {
    const parts = text.split(',').map(part => part.trim());
    const continues = ['...', '…'].includes(parts.at(-1));
    if (continues) {
        parts.pop();
    }

    const points = [];
    for (const part of parts) {
        const match = PATTERN_POINT.exec(part);
        if (!match) {
            return null;
        }
        const point = { after: Number.parseFloat(match[1]), multiplier: Number.parseFloat(match[2]) };
        const previous = points.at(-1);
        if (point.multiplier <= 0 || (previous && point.after <= previous.after)) {
            return null;
        }
        points.push(point);
    }
    if (points.length === 0) {
        return null;
    }
    if (!continues) {
        return { points, pace: null };
    }

    const last = points.at(-1);
    const previous = points.at(-2) || { after: 0, multiplier: 1 };
    const pace = { every: last.after - previous.after, adds: last.multiplier - previous.multiplier };
    return pace.every > 0 && pace.adds >= 0 ? { points, pace } : null;
}

function parseIni(text) {
    const entries = [];
    let section = null;
    text.split(LINE_BREAK).forEach((raw, index) => {
        const line = raw.trim();
        if (!line || line[0] === ';' || line[0] === '#') {
            return;
        }
        const header = INI_SECTION.exec(line);
        if (header) {
            section = header[1].trim();
            return;
        }
        const pair = INI_PAIR.exec(line);
        if (!(pair && section)) {
            throw new Failure(EXIT.config, `line ${index + 1}: expected "[section]" or "key = value" under one, got "${line}"`);
        }
        entries.push({ section, key: pair[1].trim(), text: pair[2].trim(), line: index + 1 });
    });
    return entries;
}

function resolveSettings(entries) {
    const values = {};
    const texts = {};
    for (const [section, specs] of Object.entries(SETTINGS)) {
        values[section] = {};
        texts[section] = {};
        for (const [key, spec] of Object.entries(specs)) {
            values[section][key] = spec.parse(spec.text);
            texts[section][key] = spec.text;
        }
    }
    for (const { section, key, text, line } of entries) {
        const known = Object.hasOwn(SETTINGS, section) && Object.hasOwn(SETTINGS[section], key);
        if (!known) {
            throw new Failure(EXIT.config, `line ${line}: unknown setting [${section}] ${key}`);
        }
        const value = SETTINGS[section][key].parse(text);
        if (isMissing(value)) {
            throw new Failure(EXIT.config, `line ${line}: [${section}] ${key} = "${text}" — expected ${SETTINGS[section][key].expects}`);
        }
        values[section][key] = value;
        texts[section][key] = text;
    }
    return { values, texts };
}

function formatSettings(texts) {
    return Object.entries(SETTINGS)
        .map(([section, specs]) => {
            const keys = Object.entries(specs).map(
                ([key, spec]) =>
                    `${spec.about
                        .split('\n')
                        .map(line => `; ${line}\n`)
                        .join('')}${key} = ${texts[section][key]}`
            );
            return `[${section}]\n${keys.join('\n\n')}`;
        })
        .join('\n\n');
}
