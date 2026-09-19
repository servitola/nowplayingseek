const DIALECTS = {
    'nowplaying-cli': asNowplayingCli,
    'media-control': asMediaControl,
    playerctl: asPlayerctl,
    mpc: asMpc,
    spotify: asShpotify,
    shpotify: asShpotify,
};

// A tool's name as the first word speaks its whole dialect. The words of media-control that are
// not ours are taken directly as well, so that moving over from it is a change of one word.
function dialectFor(argv, ownCommands) {
    const [name, ...args] = argv;
    if (Object.hasOwn(DIALECTS, name)) {
        return () => DIALECTS[name].run(args);
    }
    return !ownCommands.includes(name) && asMediaControl.knows(name) ? () => asMediaControl.run(argv) : null;
}
