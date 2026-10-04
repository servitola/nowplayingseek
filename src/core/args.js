const PROGRESSIVE_FLAG = '--progressive';
const HOLD_FLAG = '--hold';
const KNOB_FLAG = '--knob';
const SEEK_FLAGS = [PROGRESSIVE_FLAG, HOLD_FLAG, KNOB_FLAG];

function timeArgument(command, text, fallback) {
    if (text === undefined && fallback !== undefined) {
        return fallback;
    }
    const seconds = parseTime(text || '');
    if (isMissing(seconds)) {
        throw new Failure(EXIT.usage, `${command} needs seconds or mm:ss, got "${text || ''}"`);
    }
    return seconds;
}

const SPEAKING = [
    'status',
    'position',
    'duration',
    'forward',
    'backward',
    'seek',
    'toggle',
    'play',
    'pause',
    'next',
    'previous',
    'doctor',
    'config',
    'artwork',
];

const OFFLINE = ['config', 'release'];
const DIRECTIONS = { forward: 1, backward: -1 };
const FLAGS = {
    get: null,
    stream: null,
    release: Object.keys(DIRECTIONS),
    seek: null,
    forward: null,
    backward: null,
    config: null,
    artwork: null,
};

function rejectUnknownArguments(name, args) {
    const allowed = Object.hasOwn(FLAGS, name) ? FLAGS[name] : [];
    const unknown = allowed === null ? [] : args.filter(arg => !allowed.includes(arg));
    if (unknown.length > 0) {
        const known = SPEAKING.includes(name) ? [...allowed, '--json', '--raw', '--minify'] : allowed;
        const takes = known.length > 0 ? `only ${known.join(', ')}` : 'no arguments';
        throw new Failure(EXIT.usage, `${name} takes ${takes}, got "${unknown.join(' ')}"`);
    }
}

const seekCommand = direction => (args, name, output) => {
    const [time, ...extra] = args.filter(arg => !SEEK_FLAGS.includes(arg));
    if (extra.length > 0) {
        throw new Failure(
            EXIT.usage,
            `${name} takes one time, ${PROGRESSIVE_FLAG}, ${HOLD_FLAG} and ${KNOB_FLAG}, got "${extra.join(' ')}" on top`
        );
    }
    const [progressive, hold, knob] = SEEK_FLAGS.map(flag => args.includes(flag));
    if (knob && (hold || progressive)) {
        throw new Failure(EXIT.usage, `${name}: ${KNOB_FLAG} is one click of a knob, it goes without ${HOLD_FLAG} and ${PROGRESSIVE_FLAG}`);
    }
    const step = timeArgument(name, time, player.settings[knob ? 'knob' : 'seek'].step);
    if (step === 0) {
        throw new Failure(EXIT.usage, `${name} needs a step above zero`);
    }
    const { state, multiplier } = player.seekBy(direction * step, { progressive, hold, knob });
    show(state, output, Number(multiplier.toFixed(1)));
};
