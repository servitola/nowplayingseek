const JSON_PRETTY = 1;

// nowplaying-cli's own shape for `get`/`get-raw`, reached both through its dialect and through
// nowplayingseek's own native, undocumented `get`/`get-raw` — so it stays core, same test as
// mediaControlSeek in status.js.
const nativeGet = {
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
            safe.setObjectForKey(this.jsonValue(value), key);
        }
        const data = $.NSJSONSerialization.dataWithJSONObjectOptionsError(safe, JSON_PRETTY, null);
        return $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
    },

    jsonValue(value) {
        if (value.isKindOfClass($.NSDate)) {
            return $(value.timeIntervalSince1970);
        }
        const plain = [$.NSString, $.NSNumber, $.NSNull].some(kind => value.isKindOfClass(kind));
        return plain ? value : this.text(value, value.description);
    },

    text(value, otherwise) {
        return value.isKindOfClass($.NSData) ? value.base64EncodedStringWithOptions(0) : otherwise;
    },

    get(args) {
        const names = args.filter(arg => arg !== '--json');
        const info = this.info();
        const lookUp = name => info.objectForKey(KEY_PREFIX + name.charAt(0).toUpperCase() + name.slice(1));
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
};
