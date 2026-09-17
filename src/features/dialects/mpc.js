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
        if (command === 'volume') {
            refuse('mpc', 'volume');
        }
        const words = {
            undefined: state => this.status(state),
            status: state => this.status(state),
            current: state => print(this.current(state)),
            stop,
            repeat: () => setOrToggle('mpc', 'repeat', args[0], { on: 3, off: 1 }),
            random: () => setOrToggle('mpc', 'shuffle', args[0], { on: 3, off: 1 }),
            seek: state => {
                const place = mpcSeek(args[0] || '', state.duration || 0);
                return place ? move(place) : unknown('mpc', [command, ...args]);
            },
        };
        if (!Object.hasOwn(words, String(command))) {
            unknown('mpc', [command, ...args]);
        }
        return words[String(command)](player.requireState());
    },
};
