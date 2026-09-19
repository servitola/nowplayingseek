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
        if (this.exists()) {
            throw new Failure(EXIT.config, `${this.path()} already exists`);
        }
        return this.write(`${settingsTemplate()}\n`);
    },

    // A file that does not read is refused before it is written over; a missing one starts as `init` would write it.
    set(name, text) {
        const setting = settingAssignment(name, text);
        this.load();
        const before = this.exists()
            ? $.NSString.stringWithContentsOfFileEncodingError(this.path(), $.NSUTF8StringEncoding, null).js
            : settingsTemplate();
        return this.write(withSetting(before, setting));
    },

    // An atomic write replaces a symlink with a file; a config kept in dotfiles is written where it lives.
    write(text) {
        const path = $(this.path()).stringByResolvingSymlinksInPath.js;
        const directory = $(path).stringByDeletingLastPathComponent;
        const written =
            $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(directory, true, $(), null)
            && $(text).writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
        if (!written) {
            throw new Failure(EXIT.config, `cannot write ${path}`);
        }
        return path;
    },
};
