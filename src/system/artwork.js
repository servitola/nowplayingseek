// The bytes only a compiled block can carry; native/artwork.m is the compiled counterpart
// osascript cannot build one of, loaded into /usr/bin/perl (docs/how-it-works.md).
const ARTWORK_LOADER =
    'use DynaLoader; my $h = DynaLoader::dl_load_file($ARGV[0], 0) or exit 2; '
    + 'my $s = DynaLoader::dl_find_symbol($h, "nps_get_artwork") or exit 3; '
    + 'DynaLoader::dl_install_xsub("main::run", $s); main::run();';
let artworkCache = null;

function artworkBundlePath() {
    // dl_load_file refuses a relative path even with a matching cwd (measured); scriptDirectory
    // resolves the relative path osascript gets when run as `./nowplayingseek`, not installed.
    const directory = scriptDirectory();
    const candidate = directory && `${directory}/nowplayingseek-artwork.bundle`;
    return candidate && $.NSFileManager.defaultManager.fileExistsAtPath(candidate) ? candidate : null;
}

// Reads stdout then stderr, in that order: safe only because native/artwork.m never writes more
// than one short line to either — a longer one could fill a pipe the other side blocks draining.
function runPerl(bundle, outPath) {
    const task = $.NSTask.alloc.init;
    task.executableURL = $.NSURL.fileURLWithPath('/usr/bin/perl');
    task.arguments = ['-e', ARTWORK_LOADER, '--', bundle];
    const env = ObjC.deepUnwrap($.NSProcessInfo.processInfo.environment);
    env.NPS_ARTWORK_OUT = outPath;
    task.environment = env;
    const stdout = $.NSPipe.pipe;
    const stderr = $.NSPipe.pipe;
    task.standardOutput = stdout;
    task.standardError = stderr;
    try {
        task.launchAndReturnError(null);
    } catch {
        return null;
    }
    const read = pipe =>
        $.NSString.alloc.initWithDataEncoding(pipe.fileHandleForReading.readDataToEndOfFile, $.NSUTF8StringEncoding).js || '';
    const out = read(stdout).trim();
    const err = read(stderr).trim();
    // biome-ignore lint/suspicious/noUnusedExpressions: JXA calls a no-argument ObjC method by reading the property
    task.waitUntilExit;
    return { status: task.terminationStatus, stdout: out, stderr: err };
}

const artwork = {
    // A file the caller can send anywhere; `artwork` on the command line asks for this directly.
    // One item, one fetch: `stream` polls every 0.2 s and must not relaunch perl for the same cover.
    fetch(identifier, mimeType, wantedPath) {
        if (!identifier) {
            return null;
        }
        if (!wantedPath && artworkCache?.identifier === identifier) {
            return artworkCache;
        }
        const bundle = artworkBundlePath();
        if (!bundle) {
            throw new Failure(
                EXIT.ignored,
                'artwork needs nowplayingseek-artwork.bundle next to this binary — rebuild with "make build" or reinstall'
            );
        }
        const outPath = wantedPath || `${$.NSTemporaryDirectory().js}nowplayingseek-artwork.${(mimeType || '').split('/')[1] || 'jpg'}`;
        const result = runPerl(bundle, outPath);
        if (!result) {
            throw new Failure(EXIT.ignored, 'artwork: perl did not start');
        }
        if (result.status !== 0) {
            throw new Failure(EXIT.ignored, `artwork: ${result.stderr || `perl exit ${result.status}`}`);
        }
        if (result.stdout === 'NO_ARTWORK' || !result.stdout) {
            return null;
        }
        const fetched = { identifier, path: outPath, mimeType: result.stdout };
        if (!wantedPath) {
            artworkCache = fetched;
        }
        return fetched;
    },

    // Never throws: `get` and `stream` fall back to no cover rather than stopping over one that failed.
    base64(identifier, mimeType) {
        try {
            const fetched = this.fetch(identifier, mimeType, null);
            if (!fetched) {
                return null;
            }
            if (fetched.base64 === undefined) {
                const data = $.NSData.dataWithContentsOfFile(fetched.path);
                fetched.base64 = data.js === undefined ? null : data.base64EncodedStringWithOptions(0).js;
            }
            return fetched.base64;
        } catch {
            return null;
        }
    },
};
