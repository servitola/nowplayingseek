const PLAYERCTL_DECIMALS = 6;

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
            const value = Object.hasOwn(fields, key) ? (fields[key] ?? '') : '';
            print(args.length > 0 ? String(value) : `${fields.playerName} ${key}  ${value}`);
        }
    },

    position(text) {
        if (text === undefined) {
            return print(player.requirePosition().position.toFixed(PLAYERCTL_DECIMALS));
        }
        const place = playerctlPosition(text);
        return place ? move(place) : unknown('playerctl', ['position', text]);
    },

    run([command, ...args]) {
        if ([command, ...args].some(word => word === '-p' || String(word).startsWith('--player'))) {
            refuse('playerctl', 'choosing a player');
        }
        if (command === undefined) {
            print('playerctl needs a word: status, play, pause, play-pause, next, previous, stop, position, metadata', true);
            $.exit(EXIT.usage);
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
