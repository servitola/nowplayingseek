const SHORTEST_CLICK = 0.01;

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
