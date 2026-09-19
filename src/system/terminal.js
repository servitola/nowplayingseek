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

    columns() {
        const task = $.NSTask.alloc.init;
        const { pipe } = $.NSPipe;
        task.launchPath = '/bin/sh';
        task.arguments = ['-c', 'stty size </dev/tty 2>/dev/null'];
        task.standardOutput = pipe;
        // biome-ignore lint/suspicious/noUnusedExpressions: JXA calls a no-argument ObjC method by reading the property
        task.launch;
        // biome-ignore lint/suspicious/noUnusedExpressions: the same
        task.waitUntilExit;
        const said = $.NSString.alloc.initWithDataEncoding(pipe.fileHandleForReading.readDataToEndOfFile, $.NSUTF8StringEncoding).js;
        return parseColumns(said || '');
    },

    clock() {
        const formatter = $.NSDateFormatter.alloc.init;
        formatter.dateStyle = $.NSDateFormatterNoStyle;
        formatter.timeStyle = $.NSDateFormatterMediumStyle;
        return formatter.stringFromDate($.NSDate.date).js;
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
