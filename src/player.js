const PROCESS_STARTED = Date.now() / MILLISECONDS_PER_SECOND;
const HOLD_TOKEN = `${$.NSProcessInfo.processInfo.processIdentifier}-${PROCESS_STARTED}`;

const SHORTEST_INTERVAL = 0.05;

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
        if (alreadyThere(before.position, target)) {
            return before;
        }
        const at = now();
        mediaRemote.setElapsedTime(target);
        lastSeekFile.write({ target, at, app: before.app });
        return this.awaitLanding(target, at, before);
    },

    seekBy(delta, mode) {
        const before = this.requirePosition();
        const direction = Math.sign(delta);
        const tap = !mode.hold || releasedSince(releaseFiles[direction].read(), PROCESS_STARTED);
        if (!tap) {
            holdFile.write({ holder: HOLD_TOKEN });
        }

        const seeking = locked(() => this.begin(before, delta, mode));
        while (seeking.last && !tap && this.stillHeld(direction, before.app, seeking.last.at)) {
            if (!this.step(seeking, delta, before)) {
                break;
            }
        }
        return seeking.last
            ? { state: this.awaitLanding(seeking.target, seeking.last.at, before), multiplier: seeking.last.multiplier }
            : { state: before, multiplier: 1 };
    },

    begin(before, delta, mode) {
        const { timing, progressive: curve } = this.settings;
        const lastSeek = lastSeekFile.read();
        const direction = Math.sign(delta);
        const streak = {
            direction,
            streakStart: streakStart(lastSeek, direction, now(), curve.streak_gap),
            rate: mode.knob ? knobRate(lastSeek, direction, now(), curve.streak_gap) : undefined,
        };
        const seeking = {
            target: seekBase(before, lastSeek, now(), timing.pending_seek_max),
            last: null,
            streak,
            growth: this.growth(mode, streak),
        };
        this.step(seeking, delta, before);
        return seeking;
    },

    step(seeking, delta, before) {
        const at = now();
        const multiplier = seeking.growth(at, seeking.last !== null);
        const next = nextHoldTarget(seeking.target, delta, multiplier, before.duration);
        if (isMissing(next)) {
            return false;
        }
        seeking.target = next;
        seeking.last = { at, multiplier };
        mediaRemote.setElapsedTime(next);
        lastSeekFile.write({ target: next, at, app: before.app, ...seeking.streak });
        return true;
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

    stillHeld(direction, app, steppedAt) {
        const { interval, max_time } = this.settings.hold;
        delay(Math.max(SHORTEST_INTERVAL, interval - (now() - steppedAt)));
        if (mediaRemote.read()?.app !== app) {
            return false;
        }
        const held = holdContinues(holdFile.read(), HOLD_TOKEN, releaseFiles[direction].read(), PROCESS_STARTED);
        return held && now() - PROCESS_STARTED < max_time;
    },

    release(directions) {
        for (const direction of directions) {
            releaseFiles[direction].write({ releasedAt: now() });
        }
    },

    awaitLanding(target, calledAt, before) {
        const { timing } = this.settings;
        let after = null;
        let sentAt = calledAt;
        let resent = 0;
        const landed = waitUntil(() => {
            after = mediaRemote.read();
            const superseded = lastSeekFile.read()?.target !== target;
            if (seekOvertaken(after, target, { sentAt, superseded, resent, verifyTimeout: timing.verify_timeout })) {
                sentAt = now();
                resent += 1;
                mediaRemote.setElapsedTime(target);
            }
            return seekLanded(after, target, { calledAt, superseded, verifyTimeout: timing.verify_timeout });
        }, timing);
        if (!landed) {
            throw new Failure(EXIT.ignored, `${before.app || 'player'} ignored the seek (this player or page has no seek support)`);
        }
        return after;
    },

    send(command) {
        const before = this.requireState();
        const delivered = mediaRemote.send(command);
        const wantPlaying = expectedPlaying(command, before.playing);

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
