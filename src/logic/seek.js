const END_MARGIN = 5;
const MOST_RESENDS = 2;

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
function seekOvertaken(after, target, { sentAt, superseded, verifyTimeout, resent = 0 }) {
    if (resent >= MOST_RESENDS) {
        return false;
    }
    const refreshed = Boolean(after) && !isMissing(after.timestamp) && after.timestamp >= sentAt;
    return refreshed && !superseded && !seekLanded(after, target, { calledAt: sentAt, superseded, verifyTimeout });
}

// A step that lands on the very end ends the item, and a page with autoplay loads the next one.
function nextHoldTarget(target, delta, multiplier, duration) {
    const margin = delta > 0 ? END_MARGIN : 0;
    const upper = duration > 0 ? duration - margin : Number.POSITIVE_INFINITY;
    const next = Math.max(0, Math.min(upper, target + delta * multiplier));
    return Math.sign(next - target) === Math.sign(delta) ? next : null;
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
