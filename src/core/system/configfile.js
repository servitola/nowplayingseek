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
            const resolved = resolveSettings(parseIni(text));
            this.warnUnknown(resolved.warnings);
            return resolved;
        } catch (error) {
            if (error instanceof Failure) {
                error.message = `${this.path()}: ${error.message}`;
            }
            throw error;
        }
    },

    // A command can call load() more than once (config prints texts after settings, set reads
    // before it writes) — warn about the same file's typos once per run, not once per call.
    warnUnknown(warnings) {
        if (this.warned || warnings.length === 0) {
            return;
        }
        this.warned = true;
        for (const warning of warnings) {
            print(`nowplayingseek: warning: ${this.path()}: ${warning}`, true);
        }
    },
};
