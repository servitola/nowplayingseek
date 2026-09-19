const PLAYERCTL_DECIMALS = 6;

const appName = state => (state.app || 'player').split('.').pop();

function refuse(tool, what) {
    print(`nowplayingseek speaks ${tool} to the one player macOS elected: ${what} is out of its reach`, true);
    $.exit(1);
}

function unknown(tool, words) {
    print(`nowplayingseek does not know "${words.join(' ')}" in the dialect of ${tool}`, true);
    $.exit(EXIT.usage);
}

function move(place) {
    if (Object.hasOwn(place, 'to')) {
        return player.seekTo(place.to);
    }
    player.seekBy(place.by, {});
}

const asPlayerctl = {
    fields(state) {
        return {
            artist: state.artist,
            title: state.title,
            album: state.album,
            status: state.playing ? 'Playing' : 'Paused',
            playerName: appName(state),
            position: Math.floor(state.position * MICROSECONDS),
            'mpris:length': Math.floor(state.duration * MICROSECONDS),
            'xesam:title': state.title,
            'xesam:artist': state.artist,
            'xesam:album': state.album,
        };
    },

    state() {
        const state = mediaRemote.read();
        if (!state) {
            print('No players found', true);
            $.exit(1);
        }
        return state;
    },

    metadata(args) {
        const fields = this.fields(this.state());
        const at = args.findIndex(arg => arg === '--format' || arg === '-f');
        if (at >= 0) {
            return print(playerctlFormat(args[at + 1] || '', fields));
        }
        const keys = args.length > 0 ? args : Object.keys(fields).filter(key => key.includes(':'));
        for (const key of keys) {
            print(args.length > 0 ? String(fields[key] ?? '') : `${fields.playerName} ${key}  ${fields[key]}`);
        }
    },

    position(text) {
        if (text === undefined) {
            return print(this.state().position.toFixed(PLAYERCTL_DECIMALS));
        }
        const place = playerctlPosition(text);
        return place ? move(place) : unknown('playerctl', ['position', text]);
    },

    run([command, ...args]) {
        if (command === '-p' || String(command).startsWith('--player')) {
            refuse('playerctl', 'choosing a player');
        }
        const sent = { play: 'play', pause: 'pause', 'play-pause': 'toggle', next: 'next', previous: 'previous' };
        if (Object.hasOwn(sent, command)) {
            return player.send(sent[command]);
        }
        const words = {
            status: () => print(this.state().playing ? 'Playing' : 'Paused'),
            position: () => this.position(args[0]),
            metadata: () => this.metadata(args),
            stop: () => asMediaControl.send(MC_COMMANDS.indexOf('stop')),
            volume: () => refuse('playerctl', 'volume'),
        };
        return Object.hasOwn(words, command) ? words[command]() : unknown('playerctl', [command, ...args]);
    },
};

const asMpc = {
    current(state) {
        return [state.artist, state.title].filter(Boolean).join(' - ');
    },

    status(state) {
        const percent = state.duration > 0 ? Math.floor((state.position / state.duration) * PERCENT) : 0;
        print(this.current(state));
        print(`[${state.playing ? 'playing' : 'paused'}] #1/1   ${clock(state.position)}/${clock(state.duration || 0)} (${percent}%)`);
        print('volume: n/a   repeat: off   random: off   single: off   consume: off');
    },

    run([command, ...args]) {
        const sent = { toggle: 'toggle', play: 'play', pause: 'pause', next: 'next', prev: 'previous' };
        if (Object.hasOwn(sent, command)) {
            return player.send(sent[command]);
        }
        const state = player.requireState();
        if (command === 'seek') {
            const place = mpcSeek(args[0] || '', state.duration || 0);
            return place ? move(place) : unknown('mpc', [command, ...args]);
        }
        const words = {
            undefined: () => this.status(state),
            status: () => this.status(state),
            current: () => print(this.current(state)),
            stop: () => asMediaControl.send(MC_COMMANDS.indexOf('stop')),
            volume: () => refuse('mpc', 'volume'),
        };
        return Object.hasOwn(words, String(command)) ? words[String(command)]() : unknown('mpc', [command, ...args]);
    },
};

const asShpotify = {
    status(state, part) {
        const parts = { artist: state.artist, album: state.album, track: state.title };
        if (part) {
            return Object.hasOwn(parts, part) ? print(parts[part] || '') : unknown('spotify', ['status', part]);
        }
        print(`${appName(state)} is currently ${state.playing ? 'playing' : 'paused'}.`);
        print(`Artist: ${state.artist || ''}\nAlbum: ${state.album || ''}\nTrack: ${state.title || ''}`);
        print(`Position: ${clock(state.position)} / ${clock(state.duration || 0)}`);
    },

    run([command, ...args]) {
        if (command === 'play' && args.length > 0) {
            refuse('spotify', 'playing by name');
        }
        const sent = { play: 'play', pause: 'toggle', next: 'next', prev: 'previous' };
        if (Object.hasOwn(sent, command)) {
            return player.send(sent[command]);
        }
        const words = {
            status: () => this.status(player.requireState(), args[0]),
            pos: () => (parseTime(args[0] || '') === null ? unknown('spotify', ['pos', ...args]) : player.seekTo(parseTime(args[0]))),
            replay: () => player.seekTo(0),
            vol: () => refuse('spotify', 'volume'),
        };
        return Object.hasOwn(words, command) ? words[command]() : unknown('spotify', [command, ...args]);
    },
};
