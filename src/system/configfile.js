const configFile = {
    path() {
        const xdg = $.NSProcessInfo.processInfo.environment.objectForKey('XDG_CONFIG_HOME').js;
        const base = xdg || `${$.NSHomeDirectory().js}/.config`;
        return `${base}/nowplayingseek/config.ini`;
    },

    exists() {
        return $.NSFileManager.defaultManager.fileExistsAtPath(this.path());
    },

    load() {
        if (!this.exists()) {
            return resolveSettings([]);
        }
        const text = $.NSString.stringWithContentsOfFileEncodingError(this.path(), $.NSUTF8StringEncoding, null).js;
        try {
            if (text === undefined) {
                throw new Failure(EXIT.config, 'not readable as UTF-8 text');
            }
            return resolveSettings(parseIni(text));
        } catch (error) {
            if (error instanceof Failure) {
                error.message = `${this.path()}: ${error.message}`;
            }
            throw error;
        }
    },
};
