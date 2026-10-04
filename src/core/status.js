const MICROS = 1e6;
const MC_DASHES = /^-+/;
const MC_LONG = /^--/;
const MC_FRACTION = /\.\d+Z$/;
const MC_NUMBER = /^-?\d+(\.\d+)?$/;
const MC_LEADING_ZEROS = /^0+(?!$)/;
const STREAM_POLL = 0.2;

const mcStripZeros = text => (text === undefined || text === '0' ? text : text.replace(MC_LEADING_ZEROS, ''));

// media-control's own seek, reached both as its dialect's own command and as nowplayingseek's own
// `seek <time> --micros` flag — a native flag, so it stays core rather than naming the dialect.
function mediaControlSeek(args) {
    const micros = args.includes('--micros');
    const position = mcStripZeros(args.find(arg => arg !== '--micros'));
    if (position === undefined) {
        mcFail("Missing position for command 'seek'");
    }
    if (!MC_NUMBER.test(position)) {
        mcFail(`'${position}' is not a valid number`);
    }
    const wanted = Math.trunc(Number(position) * (micros ? 1 : MICROS));
    if (wanted < 0) {
        mcFail(`Negative values are not allowed: ${wanted}`);
    }
    player.seekTo(wanted / MICROS);
}
const MC_SHARED_OPTIONS = ['micros', 'no-artwork', 'allow-missing-title', 'human-readable'];
const MC_OPTIONS = { get: [...MC_SHARED_OPTIONS, 'now'], stream: [...MC_SHARED_OPTIONS, 'no-diff', 'debounce'] };
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

function mcOptions(command, args) {
    const options = {};
    for (const arg of args) {
        const [name, value] = arg === '-h' ? ['human-readable'] : arg.replace(MC_LONG, '').split('=');
        if (!(arg.startsWith('-') && MC_OPTIONS[command].includes(name))) {
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

function mcArtwork(payload, raw, options) {
    if (!(raw.ArtworkMIMEType && !options['no-artwork'])) {
        return;
    }
    payload.artworkMimeType = raw.ArtworkMIMEType;
    const data = artwork.base64(raw.ArtworkIdentifier, raw.ArtworkMIMEType);
    if (data) {
        payload.artworkData = options['human-readable'] ? `<${raw.ArtworkMIMEType} ${base64ByteLength(data)} bytes...>` : data;
    }
}

const status = {
    payload(options) {
        const state = mediaRemote.read();
        const raw = mediaRemote.raw(state);
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
        mcArtwork(payload, raw, options);
        for (const key of MC_PASSED_ON) {
            const value = raw[key[0].toUpperCase() + key.slice(1)];
            if (!isMissing(value)) {
                payload[key] = value;
            }
        }
        return payload;
    },

    get(args) {
        const options = mcOptions('get', args);
        print(JSON.stringify(this.payload(options), null, options['human-readable'] ? 2 : 0));
    },

    stream(args) {
        const options = mcOptions('stream', args);
        if (terminal.colours() && !options['human-readable'] && RENDERERS.watch) {
            return RENDERERS.watch({ live: false });
        }
        const emit = (diff, payload) => print(JSON.stringify({ type: 'data', diff, payload }, null, options['human-readable'] ? 2 : 0));
        let previous = null;
        emit(false, {});
        while (!terminal.readerGone()) {
            let current = this.payload(options);
            let change = streamChange(previous, current, !options['no-diff']);
            const flipped = Boolean(previous && current) && previous.playing !== current.playing;
            if (change && options.debounce > 0 && !flipped) {
                delay(options.debounce / MILLISECONDS_PER_SECOND);
                current = this.payload(options);
                change = streamChange(previous, current, !options['no-diff']);
            }
            if (change) {
                emit(change.diff, change.payload);
            }
            previous = current;
            delay(STREAM_POLL);
        }
    },
};
