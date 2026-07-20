ObjC.import('Foundation');

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
        const value = key => {
            const v = info.valueForKey(`kMRMediaRemoteNowPlayingInfo${key}`);
            return v.js === undefined ? null : v.js;
        };
        const stamp = info.valueForKey('kMRMediaRemoteNowPlayingInfoTimestamp');
        const timestamp = stamp.js ? stamp.timeIntervalSince1970 : null;
        const rate = value('PlaybackRate') || 0;
        const { client } = request.localNowPlayingPlayerPath;

        return {
            title: value('Title'),
            artist: value('Artist'),
            album: value('Album'),
            app: client.js ? client.bundleIdentifier.js : null,
            duration: value('Duration'),
            position: livePosition(value('ElapsedTime'), rate, timestamp, Date.now() / MILLISECONDS_PER_SECOND),
            playing: rate > 0,
            rate,
            timestamp,
        };
    },

    setElapsedTime(seconds) {
        $.MRMediaRemoteSetElapsedTime(seconds);
    },

    send(command) {
        return $.MRMediaRemoteSendCommand(MR_COMMAND[command], $());
    },
};
