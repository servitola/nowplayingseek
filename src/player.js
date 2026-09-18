const lastSeekStore = {
    path: `${$.NSTemporaryDirectory().js}nowplayingseek.last-seek.json`,

    read() {
        const text = $.NSString.stringWithContentsOfFileEncodingError(this.path, $.NSUTF8StringEncoding, null);
        try { return text.js ? JSON.parse(text.js) : null; } catch { return null; }
    },

    write(lastSeek) {
        $(JSON.stringify(lastSeek)).writeToFileAtomicallyEncodingError(this.path, true, $.NSUTF8StringEncoding, null);
    },
};

function waitUntil(condition, timing) {
    const deadline = Date.now() + timing.verify_timeout * MILLISECONDS_PER_SECOND;
    while (Date.now() < deadline) {
        delay(timing.poll_interval);
        if (condition()) { return true; }
    }
    return false;
}

const player = {
    settings: null,

    requireState() {
        const state = mediaRemote.read();
        if (!state) { throw new Failure(EXIT.nothingPlaying, 'nothing is playing'); }
        return state;
    },

    seekTo(wanted, before, streak) {
        if (isMissing(before.position)) { throw new Failure(EXIT.ignored, `${before.app || 'player'} does not report a position`); }

        const target = clampTarget(wanted, before.duration);
        const calledAt = Date.now() / MILLISECONDS_PER_SECOND;
        mediaRemote.setElapsedTime(target);
        lastSeekStore.write({ target, at: calledAt, ...streak });

        let after = null;
        const landed = waitUntil(() => {
            after = mediaRemote.read();
            const superseded = lastSeekStore.read()?.target !== target;
            return seekLanded(after, target, { calledAt, superseded, verifyTimeout: this.settings.timing.verify_timeout });
        }, this.settings.timing);
        if (!landed) { throw new Failure(EXIT.ignored, `${before.app || 'player'} ignored the seek (this player or page has no seek support)`); }
        return after;
    },

    seekBy(delta, progressive) {
        const { timing, progressive: acceleration } = this.settings;
        const before = this.requireState();
        const now = Date.now() / MILLISECONDS_PER_SECOND;
        const lastSeek = lastSeekStore.read();
        const streak = {
            direction: Math.sign(delta),
            streakStart: streakStart(lastSeek, Math.sign(delta), now, acceleration.streak_gap),
        };
        const multiplier = progressive
            ? multiplierAt(acceleration.pattern, now - streak.streakStart, acceleration.max_multiplier)
            : 1;
        const base = seekBase(before, lastSeek, now, timing.pending_seek_max);
        return { state: this.seekTo(base + delta * multiplier, before, streak), multiplier };
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
        if (!reacted) { throw new Failure(EXIT.ignored, `player did not react to "${command}"`); }
    },
};
