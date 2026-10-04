ObjC.import('unistd');

// struct pollfd { fd 1, events POLLOUT, revents } as base64, before poll() and as it comes back
// while someone still reads. Anything else in revents — POLLHUP, POLLNVAL — and nobody does.
const POLL_STDOUT = 'AQAAAAQAAAA=';
const POLL_STDOUT_READ = 'AQAAAAQABAA=';

const terminal = {
    colours(stream = 1) {
        const { environment } = $.NSProcessInfo.processInfo;
        const asked = name => Boolean(environment.objectForKey(name).js);
        return Boolean($.isatty(stream)) && !asked('NO_COLOR') && environment.objectForKey('TERM').js !== 'dumb';
    },

    // A command that stays would otherwise learn of a closed pipe only from its next write, and
    // with nothing changing in the player there is none.
    readerGone() {
        if (!this.poll) {
            ObjC.bindFunction('poll', ['int', ['void *', 'unsigned int', 'int']]);
            this.poll = true;
        }
        const descriptor = $.NSData.alloc.initWithBase64EncodedStringOptions(POLL_STDOUT, 0).mutableCopy;
        return $.poll(descriptor.mutableBytes, 1, 0) > 0 && descriptor.base64EncodedStringWithOptions(0).js !== POLL_STDOUT_READ;
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
        task.arguments = ['-c', 'stty size 2>/dev/null </dev/tty'];
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
