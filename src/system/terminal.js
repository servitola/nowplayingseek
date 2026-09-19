ObjC.import('unistd');

const terminal = {
    colours(stream = 1) {
        const { environment } = $.NSProcessInfo.processInfo;
        const asked = name => Boolean(environment.objectForKey(name).js);
        return Boolean($.isatty(stream)) && !asked('NO_COLOR') && environment.objectForKey('TERM').js !== 'dumb';
    },

    localTime(moment) {
        const seconds = typeof moment === 'number' ? moment : Date.parse(moment) / MILLISECONDS_PER_SECOND;
        const formatter = $.NSDateFormatter.alloc.init;
        formatter.dateStyle = $.NSDateFormatterMediumStyle;
        formatter.timeStyle = $.NSDateFormatterMediumStyle;
        return formatter.stringFromDate($.NSDate.dateWithTimeIntervalSince1970(seconds)).js;
    },

    appName(state) {
        const bundle = mediaRemote.process()?.parent || state.app;
        if (!bundle) {
            return null;
        }
        ObjC.import('AppKit');
        const url = $.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier(bundle);
        return url.js ? $.NSFileManager.defaultManager.displayNameAtPath(url.path).js : bundle;
    },
};
