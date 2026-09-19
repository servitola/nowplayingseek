ObjC.import('Foundation');

const KEY_PREFIX = 'kMRMediaRemoteNowPlayingInfo';
const MR_SETTERS = { shuffle: 'MRMediaRemoteSetShuffleMode', repeat: 'MRMediaRemoteSetRepeatMode', speed: 'MRMediaRemoteSetPlaybackSpeed' };
const MR_COMMAND = { play: 0, pause: 1, toggle: 2, next: 4, previous: 5 };

const mediaRemote = {
    load() {
        // biome-ignore lint/suspicious/noUnusedExpressions: JXA calls a no-argument ObjC method by reading the property; load() throws
        $.NSBundle.bundleWithPath('/System/Library/PrivateFrameworks/MediaRemote.framework/').load;
        ObjC.bindFunction('MRMediaRemoteSetElapsedTime', ['void', ['double']]);
        ObjC.bindFunction('MRMediaRemoteSendCommand', ['bool', ['int', 'id']]);
    },

    read() {
        const request = $.NSClassFromString('MRNowPlayingRequest');
        if (!request) {
            return null;
        }
        const item = request.localNowPlayingItem;
        if (!item.js) {
            return null;
        }

        const info = item.nowPlayingInfo;
        if (!info.js) {
            return null;
        }
        const value = key => {
            const v = info.valueForKey(`kMRMediaRemoteNowPlayingInfo${key}`);
            return v.js === undefined ? null : v.js;
        };
        const stamp = info.valueForKey('kMRMediaRemoteNowPlayingInfoTimestamp');
        const timestamp = stamp.js ? stamp.timeIntervalSince1970 : null;
        const reportedRate = value('PlaybackRate') || 0;
        const playing = request.respondsToSelector('localIsPlaying') ? Boolean(request.localIsPlaying) : reportedRate > 0;
        const rate = effectiveRate(playing, reportedRate);
        const { client } = request.localNowPlayingPlayerPath;

        return {
            title: value('Title'),
            artist: value('Artist'),
            album: value('Album'),
            app: client?.js ? client.bundleIdentifier.js : null,
            duration: value('Duration'),
            position: livePosition(value('ElapsedTime'), rate, timestamp, Date.now() / MILLISECONDS_PER_SECOND),
            playing,
            rate,
            timestamp,
        };
    },

    info() {
        const item = $.NSClassFromString('MRNowPlayingRequest')?.localNowPlayingItem;
        return item?.js && item.nowPlayingInfo.js ? item.nowPlayingInfo : null;
    },

    raw() {
        const request = $.NSClassFromString('MRNowPlayingRequest');
        const item = request?.localNowPlayingItem;
        if (!item?.js) {
            return null;
        }
        const info = item.nowPlayingInfo;
        const state = this.read();
        if (!state) {
            return null;
        }
        const { app, playing } = state;
        const everything = { app, playing };
        for (const key of ObjC.deepUnwrap(info.allKeys).sort()) {
            const value = info.valueForKey(key);
            const plain = value.isKindOfClass($.NSData) ? `<${value.length} bytes>` : ObjC.deepUnwrap(value);
            everything[key.replace(KEY_PREFIX, '')] = plain instanceof Date ? plain.toISOString() : plain;
        }
        return everything;
    },

    setElapsedTime(seconds) {
        $.MRMediaRemoteSetElapsedTime(seconds);
    },

    send(command) {
        return this.sendId(MR_COMMAND[command]);
    },

    sendId(id) {
        return $.MRMediaRemoteSendCommand(id, $());
    },

    setMode(what, value) {
        let known = true;
        try {
            ObjC.bindFunction(MR_SETTERS[what], ['void', ['int']]);
        } catch {
            known = false;
        }
        if (!known) {
            throw new Failure(EXIT.ignored, `this macOS has no way to set ${what}`);
        }
        $[MR_SETTERS[what]](value);
    },

    process() {
        const client = $.NSClassFromString('MRNowPlayingRequest')?.localNowPlayingPlayerPath?.client;
        if (!client?.js) {
            return null;
        }
        const parent = client.respondsToSelector('parentApplicationBundleIdentifier') ? client.parentApplicationBundleIdentifier.js : null;
        return { pid: client.processIdentifier, bundle: client.bundleIdentifier.js, parent };
    },
};
