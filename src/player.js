const PROCESS_STARTED = Date.now() / MILLISECONDS_PER_SECOND;
const HOLD_TOKEN = `${$.NSProcessInfo.processInfo.processIdentifier}-${PROCESS_STARTED}`;

const now = () => Date.now() / MILLISECONDS_PER_SECOND;

function jsonFile(name) {
    const path = `${$.NSTemporaryDirectory().js}nowplayingseek.${name}.json`;
    return {
        read() {
            const text = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
            try {
                return text.js ? JSON.parse(text.js) : null;
            } catch {
                return null;
            }
        },
        write(value) {
            $(JSON.stringify(value)).writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
        },
    };
}

const lastSeekFile = jsonFile('last-seek');
const holdFile = jsonFile('hold');

function waitUntil(condition, timing) {
    const deadline = Date.now() + timing.verify_timeout * MILLISECONDS_PER_SECOND;
    while (Date.now() < deadline) {
        delay(timing.poll_interval);
        if (condition()) {
            return true;
        }
    }
    return false;
}

const player = {
    settings: null,

    requireState() {
        const state = mediaRemote.read();
        if (!state) {
            throw new Failure(EXIT.nothingPlaying, 'nothing is playing');
        }
        return state;
    },

    requirePosition() {
        const state = this.requireState();
        if (isMissing(state.position)) {
            throw new Failure(EXIT.ignored, `${state.app || 'player'} does not report a position`);
        }
        return state;
    },

    seekTo(wanted) {
        const before = this.requirePosition();
        const target = clampTarget(wanted, before.duration);
        const at = now();
        mediaRemote.setElapsedTime(target);
        lastSeekFile.write({ target, at, app: before.app });
        return this.awaitLanding(target, at, before);
    },

    seekBy(delta, { progressive, hold, knob }) {
        const { timing, progressive: curve } = this.settings;
        const before = this.requirePosition();
        const lastSeek = lastSeekFile.read();
        const direction = Math.sign(delta);
        const streak = {
            direction,
            streakStart: streakStart(lastSeek, direction, now(), curve.streak_gap),
            rate: knob ? knobRate(lastSeek, direction, now(), curve.streak_gap) : undefined,
        };
        const growth = this.growth({ progressive, knob }, streak);
        const once = !hold || releasedSince(holdFile.read(), PROCESS_STARTED);
        if (!once) {
            holdFile.write({ holder: HOLD_TOKEN });
        }

        let target = seekBase(before, lastSeek, now(), timing.pending_seek_max);
        let last = null;
        do {
            const at = now();
            const multiplier = growth(at, last !== null);
            const next = nextHoldTarget(target, delta, multiplier, before.duration);
            if (isMissing(next)) {
                break;
            }
            target = next;
            last = { at, multiplier };
            mediaRemote.setElapsedTime(target);
            lastSeekFile.write({ target, at, app: before.app, ...streak });
        } while (!once && this.stillHeld());

        return last ? { state: this.awaitLanding(target, last.at, before), multiplier: last.multiplier } : { state: before, multiplier: 1 };
    },

    growth({ progressive, knob }, streak) {
        if (knob) {
            return () => knobMultiplier(streak.rate, this.settings.knob);
        }
        if (progressive) {
            return (at, gliding) => multiplierAt(at - streak.streakStart, this.settings.progressive, gliding);
        }
        return () => 1;
    },

    stillHeld() {
        const { interval, max_time } = this.settings.hold;
        delay(interval);
        return holdContinues(holdFile.read(), HOLD_TOKEN) && now() - PROCESS_STARTED < max_time;
    },

    release() {
        holdFile.write({ releasedAt: now() });
    },

    awaitLanding(target, calledAt, before) {
        const { timing } = this.settings;
        let after = null;
        const landed = waitUntil(() => {
            after = mediaRemote.read();
            const superseded = lastSeekFile.read()?.target !== target;
            return seekLanded(after, target, { calledAt, superseded, verifyTimeout: timing.verify_timeout });
        }, timing);
        if (!landed) {
            throw new Failure(EXIT.ignored, `${before.app || 'player'} ignored the seek (this player or page has no seek support)`);
        }
        return after;
    },

    send(command) {
        const before = mediaRemote.read();
        const delivered = mediaRemote.send(command);
        const wantPlaying = before ? expectedPlaying(command, before.playing) : null;

        if (delivered && isMissing(wantPlaying)) {
            delay(this.settings.timing.command_delivery);
            return;
        }
        const reacted = delivered && waitUntil(() => mediaRemote.read()?.playing === wantPlaying, this.settings.timing);
        if (!reacted) {
            throw new Failure(EXIT.ignored, `player did not react to "${command}"`);
        }
    },
};
