ObjC.import('stdlib');

const VERSION = '2026.09.11';
const STDERR = 2;

function print(text, toStderr) {
    const handle = toStderr ? $.NSFileHandle.fileHandleWithStandardError : $.NSFileHandle.fileHandleWithStandardOutput;
    handle.writeData($(`${text}\n`).dataUsingEncoding($.NSUTF8StringEncoding));
}

function showError(message) {
    const painted = terminal.colours(STDERR);
    const [first, ...usage] = message.split('\n\n');
    const rest = usage.join('\n\n');
    const tail = rest ? `\n\n${painted ? paintUsage(rest) : rest}` : '';
    print(`${painted ? paintError('nowplayingseek:') : 'nowplayingseek:'} ${first}${tail}`, true);
}

function sendCommand(_args, name, output) {
    player.send(name);
    show(player.requireState(), output);
}

// The dialects feature sets .current once it has loaded, to the same signature dialectFor() used
// to have — core never names a dialect file, only checks whether anything registered here.
const dialectRouter = { current: null };

// The watch feature registers RENDERERS.watch with its live terminal renderer; status.js's own
// stream falls back to the plain JSON it already emits for a pipe when nothing has registered.
const RENDERERS = {};

const COMMANDS = {
    status(_args, _name, output) {
        show(player.requireState(), output);
    },
    position(_args, _name, output) {
        showSeconds(player.requireState(), 'position', output);
    },
    duration(_args, _name, output) {
        showSeconds(player.requireState(), 'duration', output);
    },
    artwork(args, _name, output) {
        const [path, ...extra] = args;
        if (extra.length > 0) {
            throw new Failure(EXIT.usage, `artwork takes one optional path, got "${extra.join(' ')}" on top`);
        }
        const fetched = player.artwork(path);
        return output.shape === 'line' ? print(fetched.path) : showJson({ path: fetched.path, mimeType: fetched.mimeType }, output, null);
    },
    forward: seekCommand(1),
    backward: seekCommand(-1),
    seek(args, _name, output) {
        if (args.includes('--micros')) {
            return mediaControlSeek(args);
        }
        if (args.length > 1) {
            throw new Failure(EXIT.usage, `seek takes one time, got "${args.slice(1).join(' ')}" on top`);
        }
        show(player.seekTo(timeArgument('seek', args[0])), output);
    },
    doctor(_args, _name, output) {
        const state = mediaRemote.read();
        if (!state) {
            throw new Failure(
                EXIT.nothingPlaying,
                'nothing readable — either nothing has played since login, or this macOS no longer lets osascript read Now Playing'
            );
        }
        if (output.shape !== 'line') {
            return showJson({ ok: true, app: state.app }, output, state);
        }
        print('ok: Now Playing is readable');
    },
    release(args) {
        const asked = args.map(arg => DIRECTIONS[arg]);
        player.release(asked.length > 0 ? asked : Object.values(DIRECTIONS));
    },
    get: args => (args.some(arg => !arg.startsWith('-') || arg === '--json') ? nativeGet.get(args) : status.get(args)),
    stream: args => status.stream(args),
    'get-raw': () => print(nativeGet.json(nativeGet.info())),
    togglePlayPause: () => player.send('toggle'),
    toggle: sendCommand,
    play: sendCommand,
    pause: sendCommand,
    next: sendCommand,
    previous: sendCommand,
};

function run(argv) {
    const [name, ...args] = argv;
    if (!name || name === '-h' || name === '--help') {
        return print(terminal.colours() ? paintUsage(USAGE) : USAGE);
    }
    if (name === '--version') {
        return print(VERSION);
    }

    try {
        const dialect = dialectRouter.current?.(argv, Object.keys(COMMANDS));
        if (dialect) {
            player.settings = configFile.load().values;
            mediaRemote.load();
            return dialect();
        }
        if (!Object.hasOwn(COMMANDS, name)) {
            throw new Failure(EXIT.usage, `unknown command "${name}"\n\n${USAGE}`);
        }
        player.settings = configFile.load().values;
        const output = takeOutput(SPEAKING.includes(name) && !args.includes('--micros') ? args : []);
        const asked = SPEAKING.includes(name) && !args.includes('--micros') ? output.rest : args;
        rejectUnknownArguments(name, asked);
        if (!OFFLINE.includes(name)) {
            mediaRemote.load();
        }
        COMMANDS[name](asked, name, output);
    } catch (error) {
        if (!(error instanceof Failure)) {
            throw error;
        }
        showError(error.message);
        $.exit(error.code);
    }
}
