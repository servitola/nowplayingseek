const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MILLISECONDS_PER_SECOND = 1000;

const TIME_PATTERN = /^\d+(\.\d+)?$|^\d+(:[0-5]?\d){1,2}$/;

const EXIT = { ok: 0, nothingPlaying: 1, ignored: 2, usage: 64, config: 78 };

function Failure(code, message) {
    this.code = code;
    this.message = message;
}

const isMissing = value => value === null || value === undefined;

// ElapsedTime is a snapshot taken at Timestamp, not the current position.
function livePosition(elapsed, rate, timestamp, now) {
    if (isMissing(elapsed)) {
        return null;
    }
    if (isMissing(timestamp)) {
        return elapsed;
    }
    return elapsed + (rate || 0) * (now - timestamp);
}

function clampTarget(target, duration) {
    const upper = duration > 0 ? duration : Number.POSITIVE_INFINITY;
    return Math.max(0, Math.min(upper, target));
}

function seekBase(state, lastSeek, now, pendingSeekMax) {
    const pending = lastSeek && now - lastSeek.at < pendingSeekMax && (isMissing(state.timestamp) || state.timestamp < lastSeek.at);
    return pending ? lastSeek.target : state.position;
}

function seekLanded(after, target, { calledAt, superseded, verifyTimeout }) {
    if (!after || isMissing(after.timestamp) || after.timestamp < calledAt) {
        return false;
    }
    if (superseded) {
        return true;
    }
    const drift = after.position - target;
    return drift > -1 && drift < 1 + verifyTimeout * (after.rate || 1);
}

function streakStart(lastSeek, direction, now, gap) {
    const sameHold = lastSeek && lastSeek.direction === direction && !isMissing(lastSeek.streakStart) && now - lastSeek.at <= gap;
    return sameHold ? lastSeek.streakStart : now;
}

// A Gaussian ease: flat at the start, so a second of holding still steps by about one step and a
// tap by exactly one; the fastest growth comes at ramp/√2, and it settles at max with no moment
// where something switches. A staircase made the jump from ×1 to ×2 felt as a lurch.
const smoothMultiplier = (held, max, ramp) => 1 + (max - 1) * (1 - Math.exp(-((held / ramp) ** 2)));

function multiplierAt(pattern, held, max, ramp) {
    if (pattern.smooth) {
        return smoothMultiplier(held, max, ramp);
    }
    const reached = pattern.points.filter(point => held >= point.after);
    if (reached.length === 0) {
        return 1;
    }
    const last = reached.at(-1);
    const beyond =
        pattern.pace && reached.length === pattern.points.length
            ? Math.floor((held - last.after) / pattern.pace.every) * pattern.pace.adds
            : 0;
    return Math.min(max, last.multiplier + beyond);
}

// A held key is two processes: the press loops, the release tells it to stop through a record
// both can see. A newer press takes the record over, which stops the older loop as well.
const holdContinues = (record, token) => Boolean(record) && record.holder === token;

// On a quick tap the release can reach the record before the press does.
const releasedSince = (record, startedAt) => Boolean(record) && !isMissing(record.releasedAt) && record.releasedAt >= startedAt;

function nextHoldTarget(target, delta, multiplier, duration) {
    const next = clampTarget(target + delta * multiplier, duration);
    return next === target ? null : next;
}

function expectedPlaying(command, wasPlaying) {
    if (command === 'toggle') {
        return !wasPlaying;
    }
    if (command === 'play') {
        return true;
    }
    if (command === 'pause') {
        return false;
    }
    return null;
}

function parseTime(text) {
    if (!TIME_PATTERN.test(text)) {
        return null;
    }
    return text.split(':').reduce((total, part) => total * SECONDS_PER_MINUTE + Number.parseFloat(part), 0);
}

function formatTime(seconds) {
    if (isMissing(seconds)) {
        return '--:--';
    }
    const whole = Math.floor(seconds);
    const pad = n => String(n).padStart(2, '0');
    const h = Math.floor(whole / SECONDS_PER_HOUR);
    const m = Math.floor((whole % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const s = whole % SECONDS_PER_MINUTE;
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatStatus(state) {
    const icon = state.playing ? '▶' : '⏸';
    const who = [state.title, state.artist].filter(Boolean).join(' — ');
    return `${icon} ${formatTime(state.position)} / ${formatTime(state.duration)}  ${who}  (${state.app || '?'})`;
}
