ObjC.import('unistd');
ObjC.import('AppKit');

const terminal = {
    colours(stream = 1) {
        const { environment } = $.NSProcessInfo.processInfo;
        const asked = name => Boolean(environment.objectForKey(name).js);
        return Boolean($.isatty(stream)) && !asked('NO_COLOR') && environment.objectForKey('TERM').js !== 'dumb';
    },

    appName(state) {
        const bundle = mediaRemote.process()?.parent || state.app;
        if (!bundle) {
            return null;
        }
        const url = $.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier(bundle);
        return url.js ? $.NSFileManager.defaultManager.displayNameAtPath(url.path).js : bundle;
    },
};
