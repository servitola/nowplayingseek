const NPC_SEEK_TIME = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const NPC_TRANSPORT = { play: 'play', pause: 'pause', togglePlayPause: 'toggle', next: 'next', previous: 'previous' };
const NPC_HELP = [
    'Example Usage: ',
    '\tnowplaying-cli get-raw',
    '\tnowplaying-cli get title album artist',
    '\tnowplaying-cli get --json title album artist',
    '\tnowplaying-cli pause',
    '\tnowplaying-cli seek 60',
    '',
    'Available commands: ',
    '\tget, get-raw, play, pause, togglePlayPause, next, previous, seek <secs>',
    '',
    'Options: ',
    "\t--json\tOutput as JSON (use with 'get')",
].join('\n');
const JSON_PRETTY = 1;

const asNowplayingCli = {
    info() {
        const info = $.NSMutableDictionary.dictionary;
        const state = mediaRemote.read();
        if (!state) {
            return info;
        }
        info.addEntriesFromDictionary(mediaRemote.info());
        const live = [
            ['ElapsedTime', state.position],
            ['PlaybackRate', state.rate],
            ['ClientBundleIdentifier', state.app],
        ];
        for (const [key, value] of live) {
            if (!isMissing(value)) {
                info.setObjectForKey($(value), KEY_PREFIX + key);
            }
        }
        return info;
    },

    json(dictionary) {
        const safe = $.NSMutableDictionary.dictionary;
        for (const key of ObjC.deepUnwrap(dictionary.allKeys)) {
            const value = dictionary.objectForKey(key);
            const isDate = value.isKindOfClass($.NSDate);
            safe.setObjectForKey(isDate ? $(value.timeIntervalSince1970) : this.text(value, value), key);
        }
        const data = $.NSJSONSerialization.dataWithJSONObjectOptionsError(safe, JSON_PRETTY, null);
        return $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
    },

    text(value, otherwise) {
        return value.isKindOfClass($.NSData) ? value.base64EncodedStringWithOptions(0) : otherwise;
    },

    get(args) {
        const names = args.filter(arg => arg !== '--json');
        const info = this.info();
        const lookUp = name => info.objectForKey(KEY_PREFIX + name[0].toUpperCase() + name.slice(1));
        if (names.length < args.length) {
            const asked = $.NSMutableDictionary.dictionary;
            for (const name of names) {
                const value = lookUp(name);
                asked.setObjectForKey(value.js === undefined ? $.NSNull.null : value, name);
            }
            return print(this.json(asked));
        }
        for (const name of names) {
            const value = lookUp(name);
            print(value.js === undefined ? 'null' : ObjC.unwrap(this.text(value, value.description)));
        }
    },

    seek(text) {
        if (!NPC_SEEK_TIME.test(text)) {
            print(`Invalid seek time: ${text}\nUsage: nowplaying-cli seek <secs>`, true);
            $.exit(1);
        }
        player.seekTo(Number.parseFloat(text));
    },

    run([command, ...args]) {
        if (command === 'get') {
            return this.get(args);
        }
        if (command === 'get-raw') {
            return print(this.json(this.info()));
        }
        if (command === 'seek' && args.length === 1) {
            return this.seek(args[0]);
        }
        if (Object.hasOwn(NPC_TRANSPORT, command)) {
            return player.send(NPC_TRANSPORT[command]);
        }
        print(NPC_HELP);
    },
};
