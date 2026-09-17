const NPC_SEEK_TIME = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const NPC_TRANSPORT = { play: 'play', pause: 'pause', togglePlayPause: 'toggle', next: 'next', previous: 'previous' };
const NPC_HELP = [
    'Example Usage: ',
    '\tnowplaying-cli get-raw',
    '\tnowplaying-cli get title album artist',
    '\tnowplaying-cli get --json title album artist',
    '\tnowplaying-cli pause',
    '\tnowplaying-cli seek 60',
    '',
    'Available commands: ',
    '\tget, get-raw, play, pause, togglePlayPause, next, previous, seek <secs>',
    '',
    'Options: ',
    "\t--json\tOutput as JSON (use with 'get')",
].join('\n');
const asNowplayingCli = {
    seek(text) {
        if (!NPC_SEEK_TIME.test(text)) {
            print(`Invalid seek time: ${text}\nUsage: nowplaying-cli seek <secs>`, true);
            $.exit(1);
        }
        player.seekTo(Number.parseFloat(text));
    },

    run([command, ...args]) {
        if (command === 'get') {
            return nativeGet.get(args);
        }
        if (command === 'get-raw') {
            return print(nativeGet.json(nativeGet.info()));
        }
        if (command === 'seek' && args.length === 1) {
            return this.seek(args[0]);
        }
        if (Object.hasOwn(NPC_TRANSPORT, command)) {
            return player.send(NPC_TRANSPORT[command]);
        }
        print(NPC_HELP);
    },
};
