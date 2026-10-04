const SHORTEST_CLICK = 0.01;

function streakStart(lastSeek, direction, now, gap) {
    const sameHold = lastSeek && lastSeek.direction === direction && !isMissing(lastSeek.streakStart) && now - lastSeek.at <= gap;
    return sameHold ? lastSeek.streakStart : now;
}

const smoothstep = x => x * x * (1 + 2 * (1 - x));

const ease = (x, from, to) => from + (to - from) * (1 - Math.exp(-(x ** 2)));

function multiplierAt(held, { start, max_multiplier, ramp }, gliding) {
    const multiplier = ease(held / ramp, start, max_multiplier);
    return gliding ? multiplier : Math.max(1, multiplier);
}

function knobRate(lastSeek, direction, now, gap) {
    const sameSpin = lastSeek && lastSeek.direction === direction && now - lastSeek.at <= gap;
    return sameSpin ? 1 / Math.max(now - lastSeek.at, SHORTEST_CLICK) : 0;
}

// The pace of the last click alone, against two thresholds. Recorded hands (test/knob) turn
// carefully at 10-16 clicks a second and spin at 30-40; a pace averaged over earlier clicks lagged,
// so a careful turn reached twice the step and a spin's slow end kept its speed.
function knobMultiplier(rate, { max_multiplier, slow, fast }) {
    const x = Math.min(1, Math.max(0, (rate - slow) / Math.max(fast - slow, 1)));
    return 1 + (max_multiplier - 1) * smoothstep(x);
}

const holdContinues = (record, token, released, startedAt) =>
    Boolean(record) && record.holder === token && !releasedSince(released, startedAt);

const releasedSince = (record, startedAt) => Boolean(record) && !isMissing(record.releasedAt) && record.releasedAt >= startedAt;
