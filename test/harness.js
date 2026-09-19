ObjC.import('Foundation');
ObjC.import('stdlib');

const failures = [];
let count = 0;
const GROUPS = [];

function failureOf(core, action) {
    try {
        action();
    } catch (error) {
        return error instanceof core.Failure ? `${error.code}: ${error.message}` : String(error);
    }
    return 'no failure';
}

function same(actual, expected, name) {
    count += 1;
    const ok = typeof expected === 'number' && typeof actual === 'number' ? Math.abs(actual - expected) < 1e-9 : actual === expected;
    if (!ok) {
        failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function run(argv) {
    const source = argv.map(path => $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null).js).join('\n');
    const core = eval(`${source};({ livePosition, clampTarget, seekBase, seekLanded, expectedPlaying,
        parseTime, formatTime, formatStatus, Failure, EXIT, streakStart, multiplierAt,
        parseIni, resolveSettings, formatSettings, holdContinues, releasedSince, nextHoldTarget, knobRate, knobMultiplier, effectiveRate, seekOvertaken, alreadyThere, streamChange, playerctlPosition, mpcSeek, playerctlFormat, clock, paintStatus, paintUsage, paintIni, paintJson })`);

    for (const group of GROUPS) {
        group(core);
    }

    if (failures.length > 0) {
        $.NSFileHandle.fileHandleWithStandardError.writeData($(`${failures.join('\n')}\n`).dataUsingEncoding($.NSUTF8StringEncoding));
        $.exit(1);
    }
    return `${count} passed`;
}
