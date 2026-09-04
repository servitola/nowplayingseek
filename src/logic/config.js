const LINE_BREAK = /\r?\n/;
const INI_SECTION = /^\[([^\]]+)\]$/;
const INI_PAIR = /^([^=]+)=(.*)$/;

const setting = (text, about, expects = 'seconds above zero') => ({ text, about, expects });

const SETTINGS = {
    seek: {
        step: setting('10', 'forward / backward without a time', 'seconds or mm:ss above zero'),
    },
    progressive: {
        max_multiplier: setting(
            '2.5',
            'forward / backward --progressive: the step grows a little with every step while the key is\n'
                + 'held, and settles at this many times its size',
            'a number above zero'
        ),
        start: setting(
            '0.4',
            'a held key glides off in steps this many times the step, so a short hold stays short; a press is always a whole step',
            'a number above zero'
        ),
        ramp: setting('6', 'held this long, the step is two thirds of the way from start to max_multiplier'),
        streak_gap: setting('1', 'presses in one direction no further apart than this count as one hold'),
    },
    knob: {
        step: setting('2', 'forward / backward --knob: one click of a keyboard knob', 'seconds or mm:ss above zero'),
        max_multiplier: setting('4', 'the faster the knob spins, the longer the step — up to this many times', 'a number above zero'),
        fast: setting('18', 'spun at this pace, the step is two thirds of the way to max_multiplier', 'clicks a second above zero'),
    },
    hold: {
        interval: setting('0.2', 'forward / backward --hold: pause between steps while the key is down'),
        max_time: setting('60', 'a --hold stops by itself after this long, in case the release never arrives'),
    },
    watch: {
        interval: setting('1', 'watch: how often the line of where you are is redrawn'),
    },
    timing: {
        verify_timeout: setting('2.5', 'how long to wait for the player to do what was asked before exit 2'),
        pending_seek_max: setting('3', 'how long a held key keeps building on its previous target while Now Playing has not refreshed'),
        command_delivery: setting('0.3', 'how long next / previous linger so the command is delivered before the process exits'),
        poll_interval: setting('0.03', 'pause between Now Playing reads while waiting'),
    },
};

function parseSetting(text) {
    const value = parseTime(text);
    return value > 0 ? value : null;
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
            values[section][key] = parseSetting(spec.text);
            texts[section][key] = spec.text;
        }
    }
    for (const { section, key, text, line } of entries) {
        const known = Object.hasOwn(SETTINGS, section) && Object.hasOwn(SETTINGS[section], key);
        if (!known) {
            throw new Failure(EXIT.config, `line ${line}: unknown setting [${section}] ${key}`);
        }
        const value = parseSetting(text);
        if (isMissing(value)) {
            throw new Failure(EXIT.config, `line ${line}: [${section}] ${key} = "${text}" — expected ${SETTINGS[section][key].expects}`);
        }
        values[section][key] = value;
        texts[section][key] = text;
    }
    return { values, texts };
}

function formatSettings(texts, keyPrefix = '') {
    return Object.entries(SETTINGS)
        .map(([section, specs]) => {
            const keys = Object.entries(specs).map(
                ([key, spec]) =>
                    `${spec.about
                        .split('\n')
                        .map(line => `; ${line}\n`)
                        .join('')}${keyPrefix}${key} = ${texts[section][key]}`
            );
            return `[${section}]\n${keys.join('\n\n')}`;
        })
        .join('\n\n');
}

// Every key commented: a file of live defaults would keep its owner on yesterday's numbers for ever.
function settingsTemplate() {
    const intro = '; Remove the "; " in front of a line to put it in force. What stays commented follows the defaults.';
    return `${intro}\n\n${formatSettings(resolveSettings([]).texts, '; ')}`;
}
