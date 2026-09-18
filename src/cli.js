ObjC.import('stdlib');

const VERSION = '0.3.0';
const PROGRESSIVE_FLAG = '--progressive';
const HOLD_FLAG = '--hold';
const PRINTED_DECIMALS = 3;

const USAGE = `nowplayingseek ${VERSION} — control whatever macOS considers "now playing"

  status [--json]                   title, app, position / duration
  position                          current position, seconds
  duration                          total length, seconds
  forward [time=10]                 seek forward
  backward [time=10]                seek backward
  seek <time>                       jump to an exact position (seek 754, seek 12:34)
  toggle | play | pause | next | previous
  doctor                            exit 0 when Now Playing is readable, 1 when it is not

<time> is seconds (90, 12.5) or mm:ss / h:mm:ss (1:30, 1:02:03).

exit codes: 0 ok, 1 nothing playing or unreadable, 2 player ignored the command, 64 usage, 78 bad config

advanced (README "Advanced"):
  forward | backward --progressive  the step grows the longer the key is held
  forward | backward --hold         keep seeking until "release" — for a hotkey's key down
  release                           stop a --hold — for the key up
  config                            print the settings in effect and the config file path
  config init                       write ~/.config/nowplayingseek/config.ini with the defaults`;

function print(text, toStderr) {
    const handle = toStderr ? $.NSFileHandle.fileHandleWithStandardError : $.NSFileHandle.fileHandleWithStandardOutput;
    handle.writeData($(`${text}\n`).dataUsingEncoding($.NSUTF8StringEncoding));
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

const FLAGS = { status: ['--json'], seek: null, forward: null, backward: null, config: null };

function rejectUnknownArguments(name, args) {
    const allowed = Object.hasOwn(FLAGS, name) ? FLAGS[name] : [];
    const unknown = allowed === null ? [] : args.filter(arg => !allowed.includes(arg));
    if (unknown.length > 0) {
        const takes = allowed.length > 0 ? `only ${allowed.join(', ')}` : 'no arguments';
        throw new Failure(EXIT.usage, `${name} takes ${takes}, got "${unknown.join(' ')}"`);
    }
}

const seekCommand = direction => (args, name) => {
    const [time, ...extra] = args.filter(arg => arg !== PROGRESSIVE_FLAG && arg !== HOLD_FLAG);
    if (extra.length > 0) {
        throw new Failure(EXIT.usage, `${name} takes one time, ${PROGRESSIVE_FLAG} and ${HOLD_FLAG}, got "${extra.join(' ')}" on top`);
    }
    const step = timeArgument(name, time, player.settings.seek.step);
    const seek = args.includes(HOLD_FLAG) ? 'holdBy' : 'seekBy';
    const { state, multiplier } = player[seek](direction * step, args.includes(PROGRESSIVE_FLAG));
    print(formatStatus(state) + (multiplier === 1 ? '' : `  ×${multiplier}`));
};

const COMMANDS = {
    status(args) {
        const state = player.requireState();
        print(args.includes('--json') ? JSON.stringify(state) : formatStatus(state));
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
        if (args.length > 1) {
            throw new Failure(EXIT.usage, `seek takes one time, got "${args.slice(1).join(' ')}" on top`);
        }
        print(formatStatus(player.seekTo(timeArgument('seek', args[0]), player.requireState())));
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
        print(`; ${configFile.path()}${found}\n\n${formatSettings(configFile.load().texts)}`);
    },
    release() {
        player.release();
    },
    toggle: sendCommand,
    play: sendCommand,
    pause: sendCommand,
    next: sendCommand,
    previous: sendCommand,
};

function run(argv) {
    const [name, ...args] = argv;
    if (!name || name === '-h' || name === '--help') {
        return print(USAGE);
    }
    if (name === '--version') {
        return print(VERSION);
    }

    try {
        if (!Object.hasOwn(COMMANDS, name)) {
            throw new Failure(EXIT.usage, `unknown command "${name}"\n\n${USAGE}`);
        }
        player.settings = configFile.load().values;
        rejectUnknownArguments(name, args);
        mediaRemote.load();
        COMMANDS[name](args, name);
    } catch (error) {
        if (!(error instanceof Failure)) {
            throw error;
        }
        print(`nowplayingseek: ${error.message}`, true);
        $.exit(error.code);
    }
}
