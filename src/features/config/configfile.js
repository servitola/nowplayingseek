Object.assign(configFile, {
    init() {
        if (configFile.exists()) {
            throw new Failure(EXIT.config, `${configFile.path()} already exists`);
        }
        return configFile.write(`${settingsTemplate()}\n`);
    },

    // A file that does not read is refused before it is written over; a missing one starts as `init` would write it.
    set(name, text) {
        const setting = settingAssignment(name, text);
        configFile.load();
        const before = configFile.exists()
            ? $.NSString.stringWithContentsOfFileEncodingError(configFile.path(), $.NSUTF8StringEncoding, null).js
            : settingsTemplate();
        return configFile.write(withSetting(before, setting));
    },

    // An atomic write replaces a symlink with a file; a config kept in dotfiles is written where it lives.
    write(text) {
        const path = $(configFile.path()).stringByResolvingSymlinksInPath.js;
        const directory = $(path).stringByDeletingLastPathComponent;
        const written =
            $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(directory, true, $(), null)
            && $(text).writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
        if (!written) {
            throw new Failure(EXIT.config, `cannot write ${path}`);
        }
        return path;
    },
});
