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

    init() {
        const path = this.path();
        if (this.exists()) {
            throw new Failure(EXIT.config, `${path} already exists`);
        }
        const directory = $(path).stringByDeletingLastPathComponent;
        const written =
            $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(directory, true, $(), null)
            && $(`${formatSettings(resolveSettings([]).texts)}\n`).writeToFileAtomicallyEncodingError(
                path,
                true,
                $.NSUTF8StringEncoding,
                null
            );
        if (!written) {
            throw new Failure(EXIT.config, `cannot write ${path}`);
        }
        return path;
    },
};
