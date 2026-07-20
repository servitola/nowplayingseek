ObjC.import('Foundation');
ObjC.import('stdlib');

function run(argv) {
    const source = $.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null).js;
    const core = eval(source + `;({ livePosition, clampTarget, seekBase, seekLanded, expectedPlaying,
        parseTime, formatTime, formatStatus, Failure, EXIT, streakStart, parsePattern, multiplierAt,
        parseIni, resolveSettings, formatSettings })`);

    const failures = [];
    let count = 0;
    const failureOf = action => {
        try { action(); } catch (error) { return error instanceof core.Failure ? `${error.code}: ${error.message}` : String(error); }
        return 'no failure';
    };
    const same = (actual, expected, name) => {
        count++;
        const ok = typeof expected === 'number' && typeof actual === 'number'
            ? Math.abs(actual - expected) < 1e-9
            : actual === expected;
        if (!ok) failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    };

    same(core.livePosition(144.25, 1, 1000, 1245), 389.25, 'playing: snapshot advances by wall clock');
    same(core.livePosition(144.25, 0, 1000, 1245), 144.25, 'paused: snapshot stays put');
    same(core.livePosition(100, 2, 1000, 1010), 120, 'double speed advances twice as fast');
    same(core.livePosition(100, 1, null, 1010), 100, 'no timestamp: fall back to the snapshot');
    same(core.livePosition(null, 1, 1000, 1010), null, 'no elapsed time: position unknown');

    same(core.clampTarget(-5, 300), 0, 'clamp below zero');
    same(core.clampTarget(310, 300), 300, 'clamp past the end');
    same(core.clampTarget(150, 300), 150, 'inside the track is untouched');
    same(core.clampTarget(5000, null), 5000, 'live stream without duration has no upper bound');
    same(core.clampTarget(5000, 0), 5000, 'zero duration is treated as unknown');

    const stale = { position: 100, timestamp: 40 };
    const lastSeek = { target: 110, at: 50 };
    same(core.seekBase(stale, null, 50, 3), 100, 'first seek starts from the read position');
    same(core.seekBase(stale, lastSeek, 50.03, 3), 110, 'held key: Now Playing not refreshed yet, previous target wins');
    same(core.seekBase(stale, lastSeek, 51.5, 3), 110, 'still buffering after a second: previous target still wins');
    same(core.seekBase({ position: 111, timestamp: 50.1 }, lastSeek, 51, 3), 111, 'Now Playing refreshed after the seek: read position wins');
    same(core.seekBase(stale, lastSeek, 60, 3), 100, 'player never refreshed: stop trusting the old target');
    same(core.seekBase(stale, lastSeek, 60, 20), 110, 'a longer pending_seek_max keeps trusting it');
    same(core.seekBase({ position: 100, timestamp: null }, lastSeek, 50.03, 3), 110, 'no timestamp at all counts as not refreshed');

    same(core.seekLanded(null, 110, 50, false, 2.5), false, 'nothing playing any more');
    same(core.seekLanded({ position: 100, timestamp: 40, rate: 1 }, 110, 50, false, 2.5), false, 'not refreshed since the call');
    same(core.seekLanded({ position: 110.2, timestamp: 50.1, rate: 1 }, 110, 50, false, 2.5), true, 'refreshed and on target');
    same(core.seekLanded({ position: 0, timestamp: 50.1, rate: 1 }, 110, 50, false, 2.5), false, 'refreshed by an earlier seek, not ours');
    same(core.seekLanded({ position: 112, timestamp: 50.1, rate: 1 }, 110, 50, false, 2.5), true, 'kept playing while we polled');
    same(core.seekLanded({ position: 150, timestamp: 50.1, rate: 1 }, 110, 50, true, 2.5), true, 'a later key press took over');
    same(core.seekLanded({ position: 110, timestamp: 50.1, rate: 0 }, 110, 50, false, 2.5), true, 'paused player on target');

    same(core.seekLanded({ position: 112, timestamp: 50.1, rate: 1 }, 110, 50, false, 0.5), false, 'a shorter verify_timeout tolerates less drift');

    const held = { target: 110, at: 50, direction: 1, streakStart: 44 };
    same(core.streakStart(null, 1, 50, 1), 50, 'first press starts a hold');
    same(core.streakStart(held, 1, 50.05, 1), 44, 'key repeat continues the hold');
    same(core.streakStart(held, 1, 51.5, 1), 51.5, 'a pause longer than the gap starts over');
    same(core.streakStart(held, -1, 50.05, 1), 50.05, 'the other direction starts over');
    same(core.streakStart({ target: 110, at: 50 }, 1, 50.05, 1), 50.05, 'an absolute seek or a 2026.07.21 store breaks the hold');

    const ladder = core.parsePattern('5s:x2, 10s:x3, ...');
    same(core.multiplierAt(ladder, 0, 10), 1, 'pattern: nothing reached yet');
    same(core.multiplierAt(ladder, 4.9, 10), 1, 'pattern: just before the first point');
    same(core.multiplierAt(ladder, 5, 10), 2, 'pattern: first point');
    same(core.multiplierAt(ladder, 12, 10), 3, 'pattern: last written point');
    same(core.multiplierAt(ladder, 15, 10), 4, 'pattern: "..." continues at the pace of the last two points');
    same(core.multiplierAt(ladder, 27, 10), 6, 'pattern: and keeps going');
    same(core.multiplierAt(ladder, 600, 10), 10, 'pattern: max_multiplier caps it');
    same(core.multiplierAt(core.parsePattern('5:2,10:3'), 600, 10), 3, 'pattern: without "..." the last point holds; s and x are optional');
    same(core.multiplierAt(core.parsePattern('2s:x1.5, …'), 6.5, 10), 2.5, 'pattern: one point continues from 0s:x1; typographic ellipsis');
    same(core.multiplierAt(core.parsePattern('1s:x5, 3s:x30'), 3, 10), 10, 'pattern: written points are capped too');
    same(core.parsePattern('3s:x3, 10s:x3, ...').pace.adds, 0, 'pattern: a flat tail is allowed');
    same(core.parsePattern('10s:x3, 5s:x2'), null, 'pattern: descending times are rejected');
    same(core.parsePattern('5s:x0'), null, 'pattern: zero multiplier is rejected');
    same(core.parsePattern('5s:x3, 10s:x2, ...'), null, 'pattern: "..." cannot continue downwards');
    same(core.parsePattern('0s:x2, ...'), null, 'pattern: "..." needs a pace');
    same(core.parsePattern('..., 5s:x2'), null, 'pattern: "..." only at the end');
    same(core.parsePattern('...'), null, 'pattern: "..." alone');
    same(core.parsePattern(''), null, 'pattern: empty');
    same(core.parsePattern('fast'), null, 'pattern: garbage');

    const ini = '; comment\n# another\n\n[seek]\nstep = 1:30\r\n [ progressive ] \npattern=3s:x4\n';
    same(JSON.stringify(core.parseIni(ini)), JSON.stringify([
        { section: 'seek', key: 'step', text: '1:30', line: 5 },
        { section: 'progressive', key: 'pattern', text: '3s:x4', line: 7 },
    ]), 'ini: sections, comments, CRLF, spaces');
    same(failureOf(() => core.parseIni('step = 5')), '78: line 1: expected "[section]" or "key = value" under one, got "step = 5"', 'ini: key outside a section');
    same(failureOf(() => core.parseIni('[seek]\nstep')), '78: line 2: expected "[section]" or "key = value" under one, got "step"', 'ini: line without =');

    const defaults = core.resolveSettings([]);
    same(defaults.values.seek.step, 10, 'settings: default step');
    same(defaults.values.timing.poll_interval, 0.03, 'settings: default poll interval');
    same(core.multiplierAt(defaults.values.progressive.pattern, 10, defaults.values.progressive.max_multiplier), 3, 'settings: default pattern');
    const custom = core.resolveSettings(core.parseIni(ini));
    same(custom.values.seek.step, 90, 'settings: step accepts mm:ss');
    same(custom.values.progressive.pattern.points[0].multiplier, 4, 'settings: pattern from the file');
    same(custom.values.progressive.streak_gap, 1, 'settings: untouched keys keep their defaults');
    same(failureOf(() => core.resolveSettings(core.parseIni('[seek]\nstep = 0'))), '78: line 2: [seek] step = "0" — expected seconds or mm:ss above zero', 'settings: bad value');
    same(failureOf(() => core.resolveSettings(core.parseIni('[seek]\nstpe = 5'))), '78: line 2: unknown setting [seek] stpe', 'settings: unknown key');
    same(failureOf(() => core.resolveSettings(core.parseIni('[toString]\nx = 5'))), '78: line 2: unknown setting [toString] x', 'settings: unknown section');
    same(JSON.stringify(core.resolveSettings(core.parseIni(core.formatSettings(custom.texts))).values), JSON.stringify(custom.values), 'settings: the printed config reads back the same');

    same(core.expectedPlaying('toggle', true), false, 'toggle while playing');
    same(core.expectedPlaying('toggle', false, 2.5), true, 'toggle while paused');
    same(core.expectedPlaying('play', false, 2.5), true, 'play');
    same(core.expectedPlaying('pause', true), false, 'pause');
    same(core.expectedPlaying('next', true), null, 'next has no play state to wait for');

    same(core.parseTime('90'), 90, 'plain seconds');
    same(core.parseTime('12.5'), 12.5, 'fractional seconds');
    same(core.parseTime('1:30'), 90, 'mm:ss');
    same(core.parseTime('1:02:03'), 3723, 'h:mm:ss');
    same(core.parseTime('1:75'), null, 'seconds field over 59 is rejected');
    same(core.parseTime('-10'), null, 'negative is rejected');
    same(core.parseTime('abc'), null, 'garbage is rejected');
    same(core.parseTime(''), null, 'empty is rejected');

    same(core.formatTime(391.9), '06:31', 'mm:ss');
    same(core.formatTime(3723), '1:02:03', 'h:mm:ss past an hour');
    same(core.formatTime(null), '--:--', 'unknown');

    same(core.formatStatus({ playing: true, position: 61, duration: 125, title: 'T', artist: 'A', app: 'x.y' }),
        '▶ 01:01 / 02:05  T — A  (x.y)', 'status line');
    same(core.formatStatus({ playing: false, position: 0, duration: null, title: 'T', artist: null, app: null }),
        '⏸ 00:00 / --:--  T  (?)', 'status line with holes');

    const failure = new core.Failure(core.EXIT.ignored, 'x');
    same(failure instanceof core.Failure && failure.code === 2, true, 'Failure carries its exit code');

    if (failures.length) {
        $.NSFileHandle.fileHandleWithStandardError.writeData($(failures.join('\n') + '\n').dataUsingEncoding($.NSUTF8StringEncoding));
        $.exit(1);
    }
    return `${count} passed`;
}
