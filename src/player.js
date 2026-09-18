// MRMediaRemoteSendCommand returns true and hands the message to XPC asynchronously: a
// process that exits right away never delivers it (measured: pause with no linger did
// nothing, with 0.3 s it paused). next/previous have no state to poll for, so they linger.
const COMMAND_DELIVERY_SECONDS = 0.3;
const POLL_SECONDS = 0.03;

const lastSeekStore = {
    path: $.NSTemporaryDirectory().js + 'nowplayingseek.last-seek.json',

    read() {
        const text = $.NSString.stringWithContentsOfFileEncodingError(this.path, $.NSUTF8StringEncoding, null);
        try { return text.js ? JSON.parse(text.js) : null; } catch (e) { return null; }
    },

    write(target, at) {
        $(JSON.stringify({ target, at })).writeToFileAtomicallyEncodingError(this.path, true, $.NSUTF8StringEncoding, null);
    },
};

function waitUntil(condition) {
    const deadline = Date.now() + VERIFY_TIMEOUT_SECONDS * 1000;
    while (Date.now() < deadline) {
        delay(POLL_SECONDS);
        if (condition()) return true;
    }
    return false;
}

const player = {
    requireState() {
        const state = mediaRemote.read();
        if (!state) throw new Failure(EXIT.nothingPlaying, 'nothing is playing');
        return state;
    },

    seekTo(wanted, before) {
        if (before.position == null) throw new Failure(EXIT.ignored, `${before.app || 'player'} does not report a position`);

        const target = clampTarget(wanted, before.duration);
        const calledAt = Date.now() / 1000;
        mediaRemote.setElapsedTime(target);
        lastSeekStore.write(target, calledAt);

        let after = null;
        const landed = waitUntil(() => {
            after = mediaRemote.read();
            const superseded = (lastSeekStore.read() || {}).target !== target;
            return seekLanded(after, target, calledAt, superseded);
        });
        if (!landed) throw new Failure(EXIT.ignored, `${before.app || 'player'} ignored the seek (this player or page has no seek support)`);
        return after;
    },

    seekBy(delta) {
        const before = this.requireState();
        const base = seekBase(before, lastSeekStore.read(), Date.now() / 1000);
        return this.seekTo(base + delta, before);
    },

    send(command) {
        const before = mediaRemote.read();
        const delivered = mediaRemote.send(command);
        const wantPlaying = before ? expectedPlaying(command, before.playing) : null;

        if (delivered && wantPlaying == null) {
            delay(COMMAND_DELIVERY_SECONDS);
            return;
        }
        const reacted = delivered && waitUntil(() => (mediaRemote.read() || {}).playing === wantPlaying);
        if (!reacted) throw new Failure(EXIT.ignored, `player did not react to "${command}"`);
    },
};
