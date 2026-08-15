const MICROS = 1e6;
const MC_DASHES = /^-+/;
const MC_LONG = /^--/;
const MC_FRACTION = /\.\d+Z$/;
const STREAM_POLL = 0.2;
const MC_OPTIONS = ['now', 'micros', 'no-artwork', 'allow-missing-title', 'human-readable', 'no-diff', 'debounce'];
const MC_PASSED_ON = [
    'chapterNumber',
    'composer',
    'genre',
    'isAdvertisement',
    'isBanned',
    'isInWishList',
    'isLiked',
    'isMusicApp',
    'prohibitsSkip',
    'queueIndex',
    'radioStationIdentifier',
    'repeatMode',
    'shuffleMode',
    'supportsFastForward15Seconds',
    'supportsIsBanned',
    'supportsIsLiked',
    'supportsRewind15Seconds',
    'totalChapterCount',
    'totalDiscCount',
    'totalQueueCount',
    'totalTrackCount',
    'trackNumber',
    'uniqueIdentifier',
    'contentItemIdentifier',
    'radioStationHash',
    'mediaType',
];

const mcFail = message => {
    print(message, true);
    $.exit(1);
};

function mcOptions(args) {
    const options = {};
    for (const arg of args) {
        const [name, value] = arg === '-h' ? ['human-readable'] : arg.replace(MC_LONG, '').split('=');
        if (!(arg.startsWith('-') && MC_OPTIONS.includes(name))) {
            mcFail(`Unrecognized option '${arg.replace(MC_DASHES, '')}'`);
        }
        options[name] = value === undefined ? true : value;
    }
    return options;
}

function mcTimes(payload, state, raw, options) {
    const times = { duration: state.duration, elapsedTime: raw.ElapsedTime };
    if (options.now) {
        times.elapsedTimeNow = state.position;
    }
    for (const [key, seconds] of Object.entries(times)) {
        if (!isMissing(seconds)) {
            payload[options.micros ? `${key}Micros` : key] = options.micros ? Math.floor(seconds * MICROS) : seconds;
        }
    }
    if (!isMissing(state.timestamp)) {
        const stamp = new Date(state.timestamp * MILLISECONDS_PER_SECOND).toISOString().replace(MC_FRACTION, 'Z');
        payload[options.micros ? 'timestampEpochMicros' : 'timestamp'] = options.micros ? Math.floor(state.timestamp * MICROS) : stamp;
    }
}

const mediaControlReads = {
    payload(options) {
        const state = mediaRemote.read();
        const raw = mediaRemote.raw();
        const process = mediaRemote.process();
        const titled = Boolean(state?.title) || options['allow-missing-title'];
        if (!(state && raw && process && titled)) {
            return null;
        }
        const payload = { processIdentifier: process.pid, bundleIdentifier: process.bundle, playing: state.playing };
        if (process.parent) {
            payload.parentApplicationBundleIdentifier = process.parent;
        }
        for (const key of ['title', 'artist', 'album']) {
            if (!isMissing(state[key])) {
                payload[key] = state[key];
            }
        }
        mcTimes(payload, state, raw, options);
        payload.playbackRate = state.rate;
        if (raw.ArtworkMIMEType && !options['no-artwork']) {
            payload.artworkMimeType = raw.ArtworkMIMEType;
        }
        for (const key of MC_PASSED_ON) {
            const value = raw[key[0].toUpperCase() + key.slice(1)];
            if (!isMissing(value)) {
                payload[key] = value;
            }
        }
        return payload;
    },

    get(args) {
        const options = mcOptions(args);
        print(JSON.stringify(this.payload(options), null, options['human-readable'] ? 2 : 0));
    },

    stream(args) {
        const options = mcOptions(args);
        const emit = (diff, payload) => print(JSON.stringify({ type: 'data', diff, payload }, null, options['human-readable'] ? 2 : 0));
        let previous = null;
        emit(false, {});
        for (;;) {
            let current = this.payload(options);
            if (JSON.stringify(current) !== JSON.stringify(previous) && options.debounce > 0) {
                delay(options.debounce / MILLISECONDS_PER_SECOND);
                current = this.payload(options);
            }
            const change = streamChange(previous, current, !options['no-diff']);
            if (change) {
                emit(change.diff, change.payload);
            }
            previous = current;
            delay(STREAM_POLL);
        }
    },
};
