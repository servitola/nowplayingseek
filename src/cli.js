ObjC.import('stdlib');

const VERSION = '2026.07.21';
const PROGRESSIVE_FLAG = '--progressive';

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
  config                            print the settings in effect and the config file path
  config init                       write ~/.config/nowplayingseek/config.ini with the defaults`;

function print(text, toStderr) {
    const handle = toStderr ? $.NSFileHandle.fileHandleWithStandardError : $.NSFileHandle.fileHandleWithStandardOutput;
    handle.writeData($(text + '\n').dataUsingEncoding($.NSUTF8StringEncoding));
}

const configFile = {
    path() {
        const xdg = $.NSProcessInfo.processInfo.environment.objectForKey('XDG_CONFIG_HOME').js;
        return (xdg || $.NSHomeDirectory().js + '/.config') + '/nowplayingseek/config.ini';
    },

    exists() {
        return $.NSFileManager.defaultManager.fileExistsAtPath(this.path());
    },

    load() {
        if (!this.exists()) return resolveSettings([]);
        const text = $.NSString.stringWithContentsOfFileEncodingError(this.path(), $.NSUTF8StringEncoding, null).js;
        try {
            if (text === undefined) throw new Failure(EXIT.config, 'not readable as UTF-8 text');
            return resolveSettings(parseIni(text));
        } catch (error) {
            if (error instanceof Failure) error.message = `${this.path()}: ${error.message}`;
            throw error;
        }
    },

    init() {
        const path = this.path();
        if (this.exists()) throw new Failure(EXIT.config, `${path} already exists`);
        const directory = $(path).stringByDeletingLastPathComponent;
        const written = $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(directory, true, $(), null)
            && $(formatSettings(resolveSettings([]).texts) + '\n').writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
        if (!written) throw new Failure(EXIT.config, `cannot write ${path}`);
        return path;
    },
};

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

const seekCommand = direction => (args, name) => {
    const [time, ...extra] = args.filter(arg => arg !== PROGRESSIVE_FLAG);
    if (extra.length) throw new Failure(EXIT.usage, `${name} takes one time and ${PROGRESSIVE_FLAG}, got "${extra.join(' ')}" on top`);
    const step = timeArgument(name, time, player.settings.seek.step);
    const { state, multiplier } = player.seekBy(direction * step, args.includes(PROGRESSIVE_FLAG));
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
        print(formatStatus(player.seekTo(timeArgument('seek', args[0]), player.requireState())));
    },
    doctor() {
        if (!mediaRemote.read()) {
            throw new Failure(EXIT.nothingPlaying,
                'nothing readable — either nothing has played since login, or this macOS no longer lets osascript read Now Playing');
        }
        print('ok: Now Playing is readable');
    },
    config(args) {
        if (args[0] === 'init') return print('wrote ' + configFile.init());
        if (args.length) throw new Failure(EXIT.usage, `config takes "init" or nothing, got "${args.join(' ')}"`);
        const found = configFile.exists() ? '' : ' — not found, these are the defaults';
        print(`; ${configFile.path()}${found}\n\n${formatSettings(configFile.load().texts)}`);
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
        player.settings = configFile.load().values;
        mediaRemote.load();
        COMMANDS[name](args, name);
    } catch (error) {
        if (!(error instanceof Failure)) throw error;
        print('nowplayingseek: ' + error.message, true);
        $.exit(error.code);
    }
}
