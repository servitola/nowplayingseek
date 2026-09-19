const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MILLISECONDS_PER_SECOND = 1000;
const SHORTEST_CLICK = 0.01;
const END_MARGIN = 5;

const TIME_PATTERN = /^\d+(\.\d+)?$|^\d+(:[0-5]?\d){1,2}$/;

const EXIT = { ok: 0, nothingPlaying: 1, ignored: 2, usage: 64, config: 78 };

function Failure(code, message) {
    this.code = code;
    this.message = message;
}

const isMissing = value => value === null || value === undefined;

const effectiveRate = (isPlaying, rate) => (isPlaying ? rate || 1 : 0);

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

// A refresh can belong to an older seek: at key-repeat pace its timestamp is later than the newest
// seek's, while the position is still the older target. Only a position near the last target counts.
function seekBase(state, lastSeek, now, pendingSeekMax) {
    const recent = lastSeek && lastSeek.app === state.app && now - lastSeek.at < pendingSeekMax;
    if (!recent) {
        return state.position;
    }
    const refreshed = !isMissing(state.timestamp) && state.timestamp >= lastSeek.at;
    const drift = state.position - lastSeek.target;
    const arrived = drift > -1 && drift < 1 + (now - lastSeek.at) * (state.rate || 0);
    return refreshed && arrived ? state.position : lastSeek.target;
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

// Seeks sent 30 ms apart by separate processes reach the player in any order. The newest process
// sees a refresh that is not its own target and sends it again.
function seekOvertaken(after, target, { sentAt, superseded, verifyTimeout }) {
    const refreshed = Boolean(after) && !isMissing(after.timestamp) && after.timestamp >= sentAt;
    return refreshed && !superseded && !seekLanded(after, target, { calledAt: sentAt, superseded, verifyTimeout });
}

function streakStart(lastSeek, direction, now, gap) {
    const sameHold = lastSeek && lastSeek.direction === direction && !isMissing(lastSeek.streakStart) && now - lastSeek.at <= gap;
    return sameHold ? lastSeek.streakStart : now;
}

const ease = (x, from, to) => from + (to - from) * (1 - Math.exp(-(x ** 2)));

function multiplierAt(held, { start, max_multiplier, ramp }, gliding) {
    const multiplier = ease(held / ramp, start, max_multiplier);
    return gliding ? multiplier : Math.max(1, multiplier);
}

function knobRate(lastSeek, direction, now, gap) {
    const sameSpin = lastSeek && lastSeek.direction === direction && now - lastSeek.at <= gap;
    if (!sameSpin) {
        return 0;
    }
    const clicksPerSecond = 1 / Math.max(now - lastSeek.at, SHORTEST_CLICK);
    return (clicksPerSecond + (lastSeek.rate || 0)) / 2;
}

function knobMultiplier(rate, { max_multiplier, fast }) {
    return ease(rate / fast, 1, max_multiplier);
}

const holdContinues = (record, token, released, startedAt) =>
    Boolean(record) && record.holder === token && !releasedSince(released, startedAt);

const releasedSince = (record, startedAt) => Boolean(record) && !isMissing(record.releasedAt) && record.releasedAt >= startedAt;

// A step that lands on the very end ends the item, and a page with autoplay loads the next one.
function nextHoldTarget(target, delta, multiplier, duration) {
    const margin = delta > 0 ? END_MARGIN : 0;
    const upper = duration > 0 ? duration - margin : Number.POSITIVE_INFINITY;
    const next = Math.max(0, Math.min(upper, target + delta * multiplier));
    return Math.sign(next - target) === Math.sign(delta) ? next : null;
}

const STREAM_IDENTITY = ['processIdentifier', 'bundleIdentifier', 'parentApplicationBundleIdentifier', 'title', 'artist', 'album'];

function streamChange(previous, current, diffing) {
    if (JSON.stringify(previous) === JSON.stringify(current)) {
        return null;
    }
    if (!current) {
        return { diff: false, payload: {} };
    }
    const sameItem = diffing && previous && STREAM_IDENTITY.every(key => previous[key] === current[key]);
    if (!sameItem) {
        return { diff: false, payload: current };
    }
    const payload = {};
    for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
        if (previous[key] !== current[key]) {
            payload[key] = Object.hasOwn(current, key) ? current[key] : null;
        }
    }
    return { diff: true, payload };
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
