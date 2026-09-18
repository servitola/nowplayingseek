const EXIT = { ok: 0, nothingPlaying: 1, ignored: 2, usage: 64, config: 78 };

function Failure(code, message) {
    this.code = code;
    this.message = message;
}

const positive = parse => text => {
    const value = parse(text);
    return value > 0 ? value : null;
};

const parseNumber = text => /^\d+(\.\d+)?$/.test(text) ? parseFloat(text) : null;

const SETTINGS = {
    seek: {
        step: { text: '10', parse: positive(parseTime), expects: 'seconds or mm:ss above zero',
            about: 'forward / backward without a time' },
    },
    progressive: {
        pattern: { text: '5s:x2, 10s:x3, ...', parse: parsePattern,
            expects: '"<held seconds>:<multiplier>" points in ascending order, optionally ending with "..."',
            about: 'forward / backward --progressive: once the key has been held this long, the step is multiplied.\n'
                + 'A trailing "..." keeps going at the pace of the last two points: 15s:x4, 20s:x5 and so on.' },
        max_multiplier: { text: '10', parse: positive(parseNumber), expects: 'a number above zero',
            about: 'where "..." stops growing' },
        streak_gap: { text: '1', parse: positive(parseNumber), expects: 'seconds above zero',
            about: 'presses in one direction no further apart than this count as one hold' },
    },
    timing: {
        verify_timeout: { text: '2.5', parse: positive(parseNumber), expects: 'seconds above zero',
            about: 'how long to wait for the player to do what was asked before exit 2' },
        // A seek shows up in Now Playing 50–150 ms after the call, and over a second when a web
        // page has to buffer (measured: Vivaldi + YouTube, macOS 26.6). Key repeat is faster
        // than that, so until Now Playing refreshes, a held hotkey must build on the previous
        // target instead of the stale position. The cap stops a player that ignores seeks from
        // accumulating targets forever.
        pending_seek_max: { text: '3', parse: positive(parseNumber), expects: 'seconds above zero',
            about: 'how long a held key keeps building on its previous target while Now Playing has not refreshed' },
        // MRMediaRemoteSendCommand returns true and hands the message to XPC asynchronously: a
        // process that exits right away never delivers it (measured: pause with no linger did
        // nothing, with 0.3 s it paused). next/previous have no state to poll for, so they linger.
        command_delivery: { text: '0.3', parse: positive(parseNumber), expects: 'seconds above zero',
            about: 'how long next / previous linger so the command is delivered before the process exits' },
        poll_interval: { text: '0.03', parse: positive(parseNumber), expects: 'seconds above zero',
            about: 'pause between Now Playing reads while waiting' },
    },
};

// ElapsedTime is a snapshot taken at Timestamp, not the current position.
function livePosition(elapsed, rate, timestamp, now) {
    if (elapsed == null) return null;
    if (timestamp == null) return elapsed;
    return elapsed + (rate || 0) * (now - timestamp);
}

function clampTarget(target, duration) {
    const upper = duration > 0 ? duration : Infinity;
    return Math.max(0, Math.min(upper, target));
}

function seekBase(state, lastSeek, now, pendingSeekMax) {
    const pending = lastSeek
        && now - lastSeek.at < pendingSeekMax
        && (state.timestamp == null || state.timestamp < lastSeek.at);
    return pending ? lastSeek.target : state.position;
}

function seekLanded(after, target, calledAt, superseded, verifyTimeout) {
    if (!after || after.timestamp == null || after.timestamp < calledAt) return false;
    if (superseded) return true;
    const drift = after.position - target;
    return drift > -1 && drift < 1 + verifyTimeout * (after.rate || 1);
}

function streakStart(lastSeek, direction, now, gap) {
    const sameHold = lastSeek
        && lastSeek.direction === direction
        && lastSeek.streakStart != null
        && now - lastSeek.at <= gap;
    return sameHold ? lastSeek.streakStart : now;
}

function parsePattern(text) {
    const parts = text.split(',').map(part => part.trim());
    const continues = ['...', '…'].includes(parts[parts.length - 1]);
    if (continues) parts.pop();

    const points = [];
    for (const part of parts) {
        const match = /^(\d+(?:\.\d+)?)s?\s*:\s*x?(\d+(?:\.\d+)?)$/i.exec(part);
        if (!match) return null;
        const point = { after: parseFloat(match[1]), multiplier: parseFloat(match[2]) };
        const previous = points[points.length - 1];
        if (point.multiplier <= 0 || (previous && point.after <= previous.after)) return null;
        points.push(point);
    }
    if (!points.length) return null;
    if (!continues) return { points, pace: null };

    const last = points[points.length - 1];
    const previous = points[points.length - 2] || { after: 0, multiplier: 1 };
    const pace = { every: last.after - previous.after, adds: last.multiplier - previous.multiplier };
    return pace.every > 0 && pace.adds >= 0 ? { points, pace } : null;
}

function multiplierAt(pattern, held, max) {
    const reached = pattern.points.filter(point => held >= point.after);
    if (!reached.length) return 1;
    const last = reached[reached.length - 1];
    const beyond = pattern.pace && reached.length === pattern.points.length
        ? Math.floor((held - last.after) / pattern.pace.every) * pattern.pace.adds
        : 0;
    return Math.min(max, last.multiplier + beyond);
}

function parseIni(text) {
    const entries = [];
    let section = null;
    text.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim();
        if (!line || line[0] === ';' || line[0] === '#') return;
        const header = /^\[([^\]]+)\]$/.exec(line);
        if (header) {
            section = header[1].trim();
            return;
        }
        const pair = /^([^=]+)=(.*)$/.exec(line);
        if (!pair || !section) {
            throw new Failure(EXIT.config, `line ${index + 1}: expected "[section]" or "key = value" under one, got "${line}"`);
        }
        entries.push({ section, key: pair[1].trim(), text: pair[2].trim(), line: index + 1 });
    });
    return entries;
}

function resolveSettings(entries) {
    const values = {}, texts = {};
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
        if (!known) throw new Failure(EXIT.config, `line ${line}: unknown setting [${section}] ${key}`);
        const value = SETTINGS[section][key].parse(text);
        if (value == null) {
            throw new Failure(EXIT.config, `line ${line}: [${section}] ${key} = "${text}" — expected ${SETTINGS[section][key].expects}`);
        }
        values[section][key] = value;
        texts[section][key] = text;
    }
    return { values, texts };
}

function formatSettings(texts) {
    return Object.entries(SETTINGS).map(([section, specs]) => {
        const keys = Object.entries(specs).map(([key, spec]) =>
            spec.about.split('\n').map(line => `; ${line}\n`).join('') + `${key} = ${texts[section][key]}`);
        return `[${section}]\n${keys.join('\n\n')}`;
    }).join('\n\n');
}

function expectedPlaying(command, wasPlaying) {
    if (command === 'toggle') return !wasPlaying;
    if (command === 'play') return true;
    if (command === 'pause') return false;
    return null;
}

function parseTime(text) {
    if (!/^\d+(\.\d+)?$|^\d+(:[0-5]?\d){1,2}$/.test(text)) return null;
    return text.split(':').reduce((total, part) => total * 60 + parseFloat(part), 0);
}

function formatTime(seconds) {
    if (seconds == null) return '--:--';
    const whole = Math.floor(seconds);
    const pad = n => String(n).padStart(2, '0');
    const h = Math.floor(whole / 3600), m = Math.floor(whole % 3600 / 60), s = whole % 60;
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatStatus(state) {
    const icon = state.playing ? '▶' : '⏸';
    const who = [state.title, state.artist].filter(Boolean).join(' — ');
    return `${icon} ${formatTime(state.position)} / ${formatTime(state.duration)}  ${who}  (${state.app || '?'})`;
}
