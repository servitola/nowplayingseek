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
