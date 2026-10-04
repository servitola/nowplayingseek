Object.assign(player, {
    requireState() {
        const state = mediaRemote.read();
        if (!state) {
            throw new Failure(EXIT.nothingPlaying, 'nothing is playing');
        }
        return state;
    },

    requirePosition() {
        const state = player.requireState();
        if (isMissing(state.position)) {
            throw new Failure(EXIT.ignored, `${state.app || 'player'} does not report a position`);
        }
        return state;
    },

    send(command) {
        const before = player.requireState();
        const delivered = mediaRemote.send(command);
        const wantPlaying = expectedPlaying(command, before.playing);

        if (delivered && isMissing(wantPlaying)) {
            delay(player.settings.timing.command_delivery);
            return;
        }
        const reacted = delivered && waitUntil(() => mediaRemote.read()?.playing === wantPlaying, player.settings.timing);
        if (!reacted) {
            throw new Failure(EXIT.ignored, `player did not react to "${command}"`);
        }
    },
});
