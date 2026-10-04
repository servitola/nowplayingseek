const OUTPUT_FLAGS = ['--json', '--raw', '--minify', '--compact'];
const PRETTY_INDENT = 2;
const PRINTED_DECIMALS = 3;

// docs/scripting.md documents the output contract this implements.
function takeOutput(args) {
    const asked = flag => args.includes(flag);
    const minify = asked('--minify') || asked('--compact');
    const json = asked('--json') || minify;
    return {
        shape: (asked('--raw') && 'raw') || (json && 'json') || 'line',
        minify,
        rest: args.filter(arg => !OUTPUT_FLAGS.includes(arg)),
    };
}

function showJson(value, output, state) {
    const names = { appName: state ? terminal.appName(state) : null, localTime: terminal.localTime };
    const shown = withHuman(value, humanNotes(value, names));
    if (output.minify) {
        return print(JSON.stringify(shown));
    }
    print(terminal.colours() ? paintJson(shown) : JSON.stringify(shown, null, PRETTY_INDENT));
}

function showStatus(state, multiplier) {
    if (terminal.colours()) {
        const chapter = formatChapter(mediaRemote.raw(state) || {});
        return print(paintStatus(state, { app: terminal.appName(state), multiplier, chapter }));
    }
    print(formatStatus(state) + (multiplier === 1 ? '' : `  ×${multiplier}`));
}

// Every command that reads or moves the player ends here.
function show(state, output, multiplier = 1) {
    if (output.shape === 'line') {
        return showStatus(state, multiplier);
    }
    const moved = multiplier === 1 ? state : { ...state, multiplier };
    showJson(output.shape === 'raw' ? orderRaw(mediaRemote.raw(state)) : moved, output, state);
}

function showSeconds(state, field, output) {
    if (isMissing(state[field])) {
        throw new Failure(EXIT.ignored, `${state.app || 'player'} does not report its ${field}`);
    }
    if (output.shape === 'line') {
        return print(state[field].toFixed(PRINTED_DECIMALS));
    }
    showJson({ [field]: state[field] }, output, null);
}
