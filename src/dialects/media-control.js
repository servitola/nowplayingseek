const MC_VERSION = '0.7.7';
const MC_COMMANDS = [
    'play',
    'pause',
    'toggle-play-pause',
    'stop',
    'next-track',
    'previous-track',
    'toggle-shuffle',
    'toggle-repeat',
    'start-forward-seek',
    'end-forward-seek',
    'start-backward-seek',
    'end-backward-seek',
    'go-back-fifteen-seconds',
    'skip-fifteen-seconds',
];
const MC_VERIFIED = { 0: 'play', 1: 'pause', 2: 'toggle' };
const MC_MODES = { shuffle: { off: 1, albums: 2, tracks: 3 }, repeat: { off: 1, track: 2, playlist: 3 } };
const MC_INTEGER = /^-?\d+$/;
const MC_NUMBER = /^-?\d+(\.\d+)?$/;
const MC_LEADING_ZEROS = /^0+(?!$)/;

const mcStripZeros = text => (text === undefined || text === '0' ? text : text.replace(MC_LEADING_ZEROS, ''));

const asMediaControl = {
    knows(word) {
        return MC_COMMANDS.includes(word) || ['send', 'shuffle', 'repeat', 'speed'].includes(word);
    },

    send(id) {
        if (Object.hasOwn(MC_VERIFIED, id)) {
            return player.send(MC_VERIFIED[id]);
        }
        player.requireState();
        mediaRemote.sendId(id);
        delay(player.settings.timing.command_delivery);
    },

    sendById(text) {
        const id = mcStripZeros(text);
        if (id === undefined) {
            mcFail("Missing ID for command 'send'");
        }
        if (!MC_INTEGER.test(id)) {
            mcFail(`'${id}' is not a valid integer`);
        }
        if (!(Number(id) >= 0 && Number(id) < MC_COMMANDS.length)) {
            mcFail(`Unknown command ID: ${id}`);
        }
        this.send(Number(id));
    },

    seek(args) {
        const micros = args.includes('--micros');
        const position = mcStripZeros(args.find(arg => arg !== '--micros'));
        if (position === undefined) {
            mcFail("Missing position for command 'seek'");
        }
        if (!MC_NUMBER.test(position)) {
            mcFail(`'${position}' is not a valid number`);
        }
        const wanted = Math.trunc(Number(position) * (micros ? 1 : MICROS));
        if (wanted < 0) {
            mcFail(`Negative values are not allowed: ${wanted}`);
        }
        player.seekTo(wanted / MICROS);
    },

    mode(command, text) {
        if (text === undefined) {
            mcFail(`Missing mode for command '${command}'`);
        }
        const word = mcStripZeros(text);
        const named = Object.hasOwn(MC_MODES[command], word) ? MC_MODES[command][word] : undefined;
        const mode = MC_INTEGER.test(word) ? Number(word) : named;
        if (mode === undefined) {
            mcFail(`Invalid mode for command '${command}': '${text}'`);
        }
        if (!Object.values(MC_MODES[command]).includes(mode)) {
            mcFail(`Invalid ${command} mode: ${mode}`);
        }
        player.requireState();
        mediaRemote.setMode(command, mode);
        delay(player.settings.timing.command_delivery);
    },

    speed(text) {
        const speed = mcStripZeros(text);
        if (speed === undefined) {
            mcFail("Missing speed for command 'speed'");
        }
        if (!MC_INTEGER.test(speed)) {
            mcFail(`'${speed}' is not a valid integer`);
        }
        if (Number(speed) < 0) {
            mcFail(`Negative values are not allowed: ${speed}`);
        }
        player.requireState();
        mediaRemote.setMode('speed', Number(speed));
        delay(player.settings.timing.command_delivery);
    },

    run([command, ...args]) {
        const simple = MC_COMMANDS.indexOf(command);
        if (simple >= 0) {
            return this.send(simple);
        }
        const commands = {
            get: () => mediaControlReads.get(args),
            stream: () => mediaControlReads.stream(args),
            send: () => this.sendById(args[0]),
            seek: () => this.seek(args),
            shuffle: () => this.mode('shuffle', args[0]),
            repeat: () => this.mode('repeat', args[0]),
            speed: () => this.speed(args[0]),
            test: () => $.exit(mediaRemote.read() ? 0 : 1),
            version: () => print(`media-control ${MC_VERSION}, spoken by nowplayingseek ${VERSION}`),
            '--version': () => print(`media-control ${MC_VERSION}, spoken by nowplayingseek ${VERSION}`),
            help: () => print(MC_HELP),
            '--help': () => print(MC_HELP),
        };
        if (command === undefined) {
            return print(MC_HELP);
        }
        if (!Object.hasOwn(commands, command)) {
            mcFail(`Unknown command '${command}'`);
        }
        commands[command]();
    },
};
