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
