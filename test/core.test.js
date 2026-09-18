ObjC.import('Foundation');
ObjC.import('stdlib');

function run(argv) {
    const source = $.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null).js;
    const core = eval(source + `;({ livePosition, clampTarget, seekBase, seekLanded, expectedPlaying,
        parseTime, formatTime, formatStatus, Failure, EXIT })`);

    const failures = [];
    let count = 0;
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
    same(core.seekBase(stale, null, 50), 100, 'first seek starts from the read position');
    same(core.seekBase(stale, lastSeek, 50.03), 110, 'held key: Now Playing not refreshed yet, previous target wins');
    same(core.seekBase(stale, lastSeek, 51.5), 110, 'still buffering after a second: previous target still wins');
    same(core.seekBase({ position: 111, timestamp: 50.1 }, lastSeek, 51), 111, 'Now Playing refreshed after the seek: read position wins');
    same(core.seekBase(stale, lastSeek, 60), 100, 'player never refreshed: stop trusting the old target');
    same(core.seekBase({ position: 100, timestamp: null }, lastSeek, 50.03), 110, 'no timestamp at all counts as not refreshed');

    same(core.seekLanded(null, 110, 50, false), false, 'nothing playing any more');
    same(core.seekLanded({ position: 100, timestamp: 40, rate: 1 }, 110, 50, false), false, 'not refreshed since the call');
    same(core.seekLanded({ position: 110.2, timestamp: 50.1, rate: 1 }, 110, 50, false), true, 'refreshed and on target');
    same(core.seekLanded({ position: 0, timestamp: 50.1, rate: 1 }, 110, 50, false), false, 'refreshed by an earlier seek, not ours');
    same(core.seekLanded({ position: 112, timestamp: 50.1, rate: 1 }, 110, 50, false), true, 'kept playing while we polled');
    same(core.seekLanded({ position: 150, timestamp: 50.1, rate: 1 }, 110, 50, true), true, 'a later key press took over');
    same(core.seekLanded({ position: 110, timestamp: 50.1, rate: 0 }, 110, 50, false), true, 'paused player on target');

    same(core.expectedPlaying('toggle', true), false, 'toggle while playing');
    same(core.expectedPlaying('toggle', false), true, 'toggle while paused');
    same(core.expectedPlaying('play', false), true, 'play');
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
