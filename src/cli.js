ObjC.import('stdlib');

const VERSION = '2026.07.21';

const USAGE = `nowplayingseek ${VERSION} — control whatever macOS considers "now playing"

  status [--json]     title, app, position / duration
  position            current position, seconds
  duration            total length, seconds
  forward [time=10]   seek forward
  backward [time=10]  seek backward
  seek <time>         jump to an exact position (seek 754, seek 12:34)
  toggle | play | pause | next | previous
  doctor              exit 0 when Now Playing is readable, 1 when it is not

<time> is seconds (90, 12.5) or mm:ss / h:mm:ss (1:30, 1:02:03).

exit codes: 0 ok, 1 nothing playing or unreadable, 2 player ignored the command, 64 usage`;

function print(text, toStderr) {
    const handle = toStderr ? $.NSFileHandle.fileHandleWithStandardError : $.NSFileHandle.fileHandleWithStandardOutput;
    handle.writeData($(text + '\n').dataUsingEncoding($.NSUTF8StringEncoding));
}

function timeArgument(command, text, fallback) {
    if (text === undefined && fallback !== undefined) return fallback;
    const seconds = parseTime(text || '');
    if (seconds == null) throw new Failure(EXIT.usage, `${command} needs seconds or mm:ss, got "${text || ''}"`);
    return seconds;
}

function printSeconds(state, field) {
    if (state[field] == null) throw new Failure(EXIT.ignored, `${state.app || 'player'} does not report its ${field}`);
    print(state[field].toFixed(3));
}

const sendCommand = (args, name) => player.send(name);

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
    forward(args) {
        print(formatStatus(player.seekBy(timeArgument('forward', args[0], DEFAULT_STEP_SECONDS))));
    },
    backward(args) {
        print(formatStatus(player.seekBy(-timeArgument('backward', args[0], DEFAULT_STEP_SECONDS))));
    },
    seek(args) {
        print(formatStatus(player.seekTo(timeArgument('seek', args[0]), player.requireState())));
    },
    doctor() {
        if (!mediaRemote.read()) {
            throw new Failure(EXIT.nothingPlaying,
                'nothing readable — either nothing has played since login, or this macOS no longer lets osascript read Now Playing');
        }
        print('ok: Now Playing is readable');
    },
    toggle: sendCommand,
    play: sendCommand,
    pause: sendCommand,
    next: sendCommand,
    previous: sendCommand,
};

function run(argv) {
    const [name, ...args] = argv;
    if (!name || name === '-h' || name === '--help') return print(USAGE);
    if (name === '--version') return print(VERSION);

    try {
        if (!Object.hasOwn(COMMANDS, name)) throw new Failure(EXIT.usage, `unknown command "${name}"\n\n${USAGE}`);
        mediaRemote.load();
        COMMANDS[name](args, name);
    } catch (error) {
        if (!(error instanceof Failure)) throw error;
        print('nowplayingseek: ' + error.message, true);
        $.exit(error.code);
    }
}
