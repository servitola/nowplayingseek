const DIALECTS = {
    'nowplaying-cli': asNowplayingCli,
    'media-control': asMediaControl,
    playerctl: asPlayerctl,
    mpc: asMpc,
    spotify: asShpotify,
    shpotify: asShpotify,
};

const ALWAYS_EXIT_0 = ['nowplaying-cli', 'media-control'];

// nowplaying-cli and media-control exit 0 whether or not the player listened; behind their names, so do we.
function asTheOriginalExits(name, speak) {
    try {
        speak();
    } catch (error) {
        const theirsIsZero = ALWAYS_EXIT_0.includes(name) && [EXIT.nothingPlaying, EXIT.ignored].includes(error.code);
        if (!(error instanceof Failure && theirsIsZero)) {
            throw error;
        }
    }
}

// A tool's name as the first word speaks its whole dialect; media-control's own words are taken
// directly too, so moving over from it is a change of one word.
function dialectFor(argv, ownCommands) {
    const [name, ...args] = argv;
    if (Object.hasOwn(DIALECTS, name)) {
        return () => asTheOriginalExits(name, () => DIALECTS[name].run(args));
    }
    return !ownCommands.includes(name) && asMediaControl.knows(name) ? () => asMediaControl.run(argv) : null;
}

// core's cli.js checks dialectRouter.current, never this file by name — AGENTS.md's core/feature rule.
dialectRouter.current = dialectFor;
