ObjC.import('Foundation');

// Stands in for src/system/mediaremote.js: the state is a file, every command is a line in a log.
const KEY_PREFIX = 'kMRMediaRemoteNowPlayingInfo';
const MR_COMMAND = { play: 0, pause: 1, toggle: 2, next: 4, previous: 5 };
const FAKE = $.NSProcessInfo.processInfo.environment.objectForKey('NPS_FAKE').js;
const fakeText = name => $.NSString.stringWithContentsOfFileEncodingError(`${FAKE}/${name}`, $.NSUTF8StringEncoding, null).js;
const fakeWrite = (name, text) => $(text).writeToFileAtomicallyEncodingError(`${FAKE}/${name}`, true, $.NSUTF8StringEncoding, null);
const fakeLog = line => fakeWrite('calls.log', `${fakeText('calls.log') || ''}${line}\n`);
const fakeState = () => JSON.parse(fakeText('state.json') || 'null');

const mediaRemote = {
    load() {
        return null;
    },
    read() {
        const state = fakeState();
        return state && { ...state.now, rate: effectiveRate(state.now.playing, state.now.rate) };
    },
    info: () => null,
    raw(known) {
        const state = known || this.read();
        if (!state) {
            return null;
        }
        const base = {
            app: state.app,
            playing: state.playing,
            Title: state.title,
            Duration: state.duration,
            ElapsedTime: state.position,
            PlaybackRate: state.rate,
            Timestamp: state.timestamp,
        };
        if (state.artworkIdentifier) {
            base.ArtworkIdentifier = state.artworkIdentifier;
            base.ArtworkMIMEType = state.artworkMimeType;
        }
        return base;
    },
    setElapsedTime(seconds) {
        fakeLog(`setElapsedTime ${seconds}`);
        const state = fakeState();
        if (state.obeys) {
            state.now.position = seconds;
            state.now.timestamp = Date.now() / MILLISECONDS_PER_SECOND;
            fakeWrite('state.json', JSON.stringify(state));
        }
    },
    send(command) {
        return this.sendId(MR_COMMAND[command]);
    },
    sendId(id) {
        fakeLog(`send ${id}`);
        const state = fakeState();
        if (state.obeys && id <= MR_COMMAND.toggle) {
            state.now.playing = id === MR_COMMAND.toggle ? !state.now.playing : id === MR_COMMAND.play;
            fakeWrite('state.json', JSON.stringify(state));
        }
        return true;
    },
    setMode(what, value) {
        fakeLog(`setMode ${what} ${value}`);
    },
    process() {
        const state = fakeState();
        return state && { pid: 1, bundle: state.now.app, parent: null };
    },
};
