ObjC.import('stdlib');

const VERSION = '2026.08.19';
const PROGRESSIVE_FLAG = '--progressive';
const HOLD_FLAG = '--hold';
const KNOB_FLAG = '--knob';
const SEEK_FLAGS = [PROGRESSIVE_FLAG, HOLD_FLAG, KNOB_FLAG];
const PRINTED_DECIMALS = 3;
const RAW_INDENT = 2;
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

function showJson(value, indent) {
    print(terminal.colours() ? paintJson(value) : JSON.stringify(value, null, indent));
}

function showStatus(state, multiplier) {
    if (terminal.colours()) {
        const chapter = formatChapter(mediaRemote.raw(state) || {});
        return print(paintStatus(state, { app: terminal.appName(state), multiplier, chapter }));
    }
    print(formatStatus(state) + (multiplier === 1 ? '' : `  ×${multiplier}`));
}

function timeArgument(command, text, fallback) {
    if (text === undefined && fallback !== undefined) {
        return fallback;
    }
    const seconds = parseTime(text || '');
    if (isMissing(seconds)) {
        throw new Failure(EXIT.usage, `${command} needs seconds or mm:ss, got "${text || ''}"`);
    }
    return seconds;
}

function printSeconds(state, field) {
    if (isMissing(state[field])) {
        throw new Failure(EXIT.ignored, `${state.app || 'player'} does not report its ${field}`);
    }
    print(state[field].toFixed(PRINTED_DECIMALS));
}

const sendCommand = (_args, name) => player.send(name);

const OFFLINE = ['config', 'release'];
const DIRECTIONS = { forward: 1, backward: -1 };
const FLAGS = {
    status: ['--json', '--raw'],
    get: null,
    stream: null,
    release: Object.keys(DIRECTIONS),
    seek: null,
    forward: null,
    backward: null,
    config: null,
};

function rejectUnknownArguments(name, args) {
    const allowed = Object.hasOwn(FLAGS, name) ? FLAGS[name] : [];
    const unknown = allowed === null ? [] : args.filter(arg => !allowed.includes(arg));
    if (unknown.length > 0) {
        const takes = allowed.length > 0 ? `only ${allowed.join(', ')}` : 'no arguments';
        throw new Failure(EXIT.usage, `${name} takes ${takes}, got "${unknown.join(' ')}"`);
    }
}

const seekCommand = direction => (args, name) => {
    const [time, ...extra] = args.filter(arg => !SEEK_FLAGS.includes(arg));
    if (extra.length > 0) {
        throw new Failure(
            EXIT.usage,
            `${name} takes one time, ${PROGRESSIVE_FLAG}, ${HOLD_FLAG} and ${KNOB_FLAG}, got "${extra.join(' ')}" on top`
        );
    }
    const [progressive, hold, knob] = SEEK_FLAGS.map(flag => args.includes(flag));
    if (knob && (hold || progressive)) {
        throw new Failure(EXIT.usage, `${name}: ${KNOB_FLAG} is one click of a knob, it goes without ${HOLD_FLAG} and ${PROGRESSIVE_FLAG}`);
    }
    const step = timeArgument(name, time, player.settings[knob ? 'knob' : 'seek'].step);
    if (step === 0) {
        throw new Failure(EXIT.usage, `${name} needs a step above zero`);
    }
    const { state, multiplier } = player.seekBy(direction * step, { progressive, hold, knob });
    showStatus(state, Number(multiplier.toFixed(1)));
};

const COMMANDS = {
    status(args) {
        const state = player.requireState();
        if (args.includes('--raw')) {
            return showJson(orderRaw(mediaRemote.raw()), RAW_INDENT);
        }
        return args.includes('--json') ? showJson(state, 0) : showStatus(state, 1);
    },
    position() {
        printSeconds(player.requireState(), 'position');
    },
    duration() {
        printSeconds(player.requireState(), 'duration');
    },
    forward: seekCommand(1),
    backward: seekCommand(-1),
    seek(args) {
        if (args.includes('--micros')) {
            return asMediaControl.seek(args);
        }
        if (args.length > 1) {
            throw new Failure(EXIT.usage, `seek takes one time, got "${args.slice(1).join(' ')}" on top`);
        }
        showStatus(player.seekTo(timeArgument('seek', args[0])), 1);
    },
    doctor() {
        if (!mediaRemote.read()) {
            throw new Failure(
                EXIT.nothingPlaying,
                'nothing readable — either nothing has played since login, or this macOS no longer lets osascript read Now Playing'
            );
        }
        print('ok: Now Playing is readable');
    },
    config(args) {
        if (args.length === 1 && args[0] === 'init') {
            return print(`wrote ${configFile.init()}`);
        }
        if (args.length > 0) {
            throw new Failure(EXIT.usage, `config takes "init" or nothing, got "${args.join(' ')}"`);
        }
        const found = configFile.exists() ? '' : ' — not found, these are the defaults';
        const listing = `; ${configFile.path()}${found}\n\n${formatSettings(configFile.load().texts)}`;
        print(terminal.colours() ? paintIni(listing) : listing);
    },
    release(args) {
        const asked = args.map(arg => DIRECTIONS[arg]);
        player.release(asked.length > 0 ? asked : Object.values(DIRECTIONS));
    },
    get: args => (args.some(arg => !arg.startsWith('-') || arg === '--json') ? asNowplayingCli.get(args) : mediaControlReads.get(args)),
    stream: args => mediaControlReads.stream(args),
    'get-raw': () => asNowplayingCli.run(['get-raw']),
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
        const dialect = dialectFor(argv, Object.keys(COMMANDS));
        if (dialect) {
            player.settings = configFile.load().values;
            mediaRemote.load();
            return dialect();
        }
        if (!Object.hasOwn(COMMANDS, name)) {
            throw new Failure(EXIT.usage, `unknown command "${name}"\n\n${USAGE}`);
        }
        player.settings = configFile.load().values;
        rejectUnknownArguments(name, args);
        if (!OFFLINE.includes(name)) {
            mediaRemote.load();
        }
        COMMANDS[name](args, name);
    } catch (error) {
        if (!(error instanceof Failure)) {
            throw error;
        }
        showError(error.message);
        $.exit(error.code);
    }
}
