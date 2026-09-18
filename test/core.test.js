function testPosition(core) {
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
}

function testSeekBase(core) {
    const stale = { position: 100, timestamp: 40 };
    const lastSeek = { target: 110, at: 50 };
    same(core.seekBase(stale, null, 50, 3), 100, 'first seek starts from the read position');
    same(core.seekBase(stale, lastSeek, 50.03, 3), 110, 'held key: Now Playing not refreshed yet, previous target wins');
    same(core.seekBase(stale, lastSeek, 51.5, 3), 110, 'still buffering after a second: previous target still wins');
    same(
        core.seekBase({ position: 111, timestamp: 50.1 }, lastSeek, 51, 3),
        111,
        'Now Playing refreshed after the seek: read position wins'
    );
    same(core.seekBase(stale, lastSeek, 60, 3), 100, 'player never refreshed: stop trusting the old target');
    same(core.seekBase(stale, lastSeek, 60, 20), 110, 'a longer pending_seek_max keeps trusting it');
    same(core.seekBase({ position: 100, timestamp: null }, lastSeek, 50.03, 3), 110, 'no timestamp at all counts as not refreshed');
}

function testSeekLanded(core) {
    same(core.seekLanded(null, 110, { calledAt: 50, superseded: false, verifyTimeout: 2.5 }), false, 'nothing playing any more');
    same(
        core.seekLanded({ position: 100, timestamp: 40, rate: 1 }, 110, { calledAt: 50, superseded: false, verifyTimeout: 2.5 }),
        false,
        'not refreshed since the call'
    );
    same(
        core.seekLanded({ position: 110.2, timestamp: 50.1, rate: 1 }, 110, { calledAt: 50, superseded: false, verifyTimeout: 2.5 }),
        true,
        'refreshed and on target'
    );
    same(
        core.seekLanded({ position: 0, timestamp: 50.1, rate: 1 }, 110, { calledAt: 50, superseded: false, verifyTimeout: 2.5 }),
        false,
        'refreshed by an earlier seek, not ours'
    );
    same(
        core.seekLanded({ position: 112, timestamp: 50.1, rate: 1 }, 110, { calledAt: 50, superseded: false, verifyTimeout: 2.5 }),
        true,
        'kept playing while we polled'
    );
    same(
        core.seekLanded({ position: 150, timestamp: 50.1, rate: 1 }, 110, { calledAt: 50, superseded: true, verifyTimeout: 2.5 }),
        true,
        'a later key press took over'
    );
    same(
        core.seekLanded({ position: 110, timestamp: 50.1, rate: 0 }, 110, { calledAt: 50, superseded: false, verifyTimeout: 2.5 }),
        true,
        'paused player on target'
    );

    same(
        core.seekLanded({ position: 112, timestamp: 50.1, rate: 1 }, 110, { calledAt: 50, superseded: false, verifyTimeout: 0.5 }),
        false,
        'a shorter verify_timeout tolerates less drift'
    );
}

function testStreak(core) {
    const held = { target: 110, at: 50, direction: 1, streakStart: 44 };
    same(core.streakStart(null, 1, 50, 1), 50, 'first press starts a hold');
    same(core.streakStart(held, 1, 50.05, 1), 44, 'key repeat continues the hold');
    same(core.streakStart(held, 1, 51.5, 1), 51.5, 'a pause longer than the gap starts over');
    same(core.streakStart(held, -1, 50.05, 1), 50.05, 'the other direction starts over');
    same(core.streakStart({ target: 110, at: 50 }, 1, 50.05, 1), 50.05, 'an absolute seek or a 0.2.0 store breaks the hold');
}

function testTransport(core) {
    same(core.expectedPlaying('toggle', true), false, 'toggle while playing');
    same(core.expectedPlaying('toggle', false, 2.5), true, 'toggle while paused');
    same(core.expectedPlaying('play', false, 2.5), true, 'play');
    same(core.expectedPlaying('pause', true), false, 'pause');
    same(core.expectedPlaying('next', true), null, 'next has no play state to wait for');
}

function testTime(core) {
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
}

function testStatus(core) {
    same(
        core.formatStatus({ playing: true, position: 61, duration: 125, title: 'T', artist: 'A', app: 'x.y' }),
        '▶ 01:01 / 02:05  T — A  (x.y)',
        'status line'
    );
    same(
        core.formatStatus({ playing: false, position: 0, duration: null, title: 'T', artist: null, app: null }),
        '⏸ 00:00 / --:--  T  (?)',
        'status line with holes'
    );

    const failure = new core.Failure(core.EXIT.ignored, 'x');
    same(failure instanceof core.Failure && failure.code === 2, true, 'Failure carries its exit code');
}
GROUPS.push(testPosition, testSeekBase, testSeekLanded, testStreak, testTransport, testTime, testStatus);
