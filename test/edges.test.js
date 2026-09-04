function testSkepticTime(core) {
    same(core.parseTime('x1:30'), null, 'a clock with garbage in front is rejected');
    same(core.parseTime('1:02:03:04'), null, 'four clock fields are rejected');
    same(core.parseTime('1:5'), 65, 'a one-digit seconds field is read as written');
    same(
        JSON.stringify(core.EXIT),
        '{"ok":0,"nothingPlaying":1,"ignored":2,"usage":64,"config":78}',
        'the exit codes are the documented ones'
    );
}

function testSkepticSeek(core) {
    const lastSeek = { target: 110, at: 50 };
    same(core.clampTarget(5, 0.5), 0.5, 'a half-second item still has an end');
    same(
        core.seekBase({ position: 109.6, timestamp: 40 }, lastSeek, 50.03, 3),
        110,
        'a stale read that happens to be near the target is still stale: the target wins'
    );
    same(core.seekBase({ position: 100, timestamp: 40 }, lastSeek, 53, 3), 100, 'pending_seek_max itself is already too long ago');
    same(
        core.seekBase({ position: 110.3, timestamp: 50, rate: 0 }, lastSeek, 50.2, 3),
        110.3,
        'a refresh stamped at the very moment of the seek counts'
    );
    same(
        core.seekBase({ position: 108.5, timestamp: 50.1, rate: 0 }, lastSeek, 50.2, 3),
        110,
        'refreshed 1.5 s short of the target: an older seek, the target wins'
    );
    same(
        core.seekBase({ position: 109.5, timestamp: 50.1, rate: 0 }, lastSeek, 50.2, 3),
        109.5,
        'refreshed half a second short: that is where the player landed'
    );
    same(
        core.seekBase({ position: 111.5, timestamp: 50.1, rate: 0 }, lastSeek, 50.2, 3),
        110,
        'refreshed 1.5 s past the target while paused: not ours'
    );
    same(core.seekBase({ position: 111.5, timestamp: 50.1 }, lastSeek, 52, 3), 110, 'no rate is not playing: 1.5 s past is not ours');

    same(core.alreadyThere(100, 100.4), true, 'four tenths away is there');
    same(core.alreadyThere(100, 100.5), false, 'half a second away is a seek');
    same(core.alreadyThere(100, 100.6), false, 'six tenths away is a seek');

    const opts = { calledAt: 50, superseded: false, verifyTimeout: 2.5 };
    same(
        core.seekLanded({ position: 110, timestamp: 40, rate: 1 }, 110, opts),
        false,
        'on target, but not refreshed since the call: not yet'
    );
    same(core.seekLanded({ position: 110, timestamp: 50, rate: 1 }, 110, opts), true, 'a refresh stamped at the call counts');
    same(core.seekLanded({ position: 108.5, timestamp: 50.1, rate: 1 }, 110, opts), false, '1.5 s short is not landed');
    same(core.seekLanded({ position: 109.5, timestamp: 50.1, rate: 1 }, 110, opts), true, 'half a second short is landed');
    same(
        core.seekLanded({ position: 113, timestamp: 50.1, rate: 1 }, 110, opts),
        true,
        'played on for 3 s within a 2.5 s wait plus a second'
    );
    same(core.seekLanded({ position: 112, timestamp: 50.1 }, 110, opts), true, 'no rate: assume it plays on');

    const sent = { sentAt: 50, superseded: false, verifyTimeout: 2.5 };
    const short = { position: 160, timestamp: 50.2, rate: 0 };
    same(core.seekOvertaken(short, 170, { ...sent, resent: 1 }), true, 'one re-send done: a second is allowed');
    same(core.seekOvertaken({ ...short, timestamp: 50 }, 170, sent), true, 'a refresh stamped at the send counts');

    same(core.nextHoldTarget(599, -2, 1, 600), 597, 'the end margin is for forward steps only');
}

function testSkepticHold(core) {
    const held = { target: 110, at: 50, direction: 1, streakStart: 44 };
    same(
        core.streakStart({ target: 110, at: 50, direction: 1 }, 1, 50.05, 1),
        50.05,
        'a direction without a streak start begins a new hold'
    );
    same(core.streakStart(held, 1, 51, 1), 44, 'exactly the gap apart still continues the hold');
    same(core.knobRate({ target: 110, at: 50, direction: 1, rate: 10 }, 1, 51, 1), 5.5, 'knob: exactly the gap apart is still one spin');
    same(
        core.multiplierAt(3, { start: 0.4, max_multiplier: 2.5, ramp: 6 }, true),
        0.4 + 2.1 * (1 - Math.exp(-0.25)),
        'halfway up the ramp the curve is the Gaussian one'
    );
    same(core.releasedSince({ releasedAt: 50 }, 50), true, 'a release at the very instant of the press counts');
}

function testSkepticStream(core) {
    const song = {
        processIdentifier: 7,
        bundleIdentifier: 'a',
        parentApplicationBundleIdentifier: 'p',
        title: 'One',
        artist: 'X',
        album: 'A',
    };
    const json = value => JSON.stringify(value);
    for (const [key, other] of [
        ['processIdentifier', 8],
        ['bundleIdentifier', 'b'],
        ['parentApplicationBundleIdentifier', 'q'],
        ['album', 'B'],
    ]) {
        const next = { ...song, [key]: other };
        same(json(core.streamChange(song, next, true)), json({ diff: false, payload: next }), `stream: another ${key} is another item`);
    }
    same(
        json(core.streamChange(song, { ...song, genre: 'g' }, true)),
        json({ diff: true, payload: { genre: 'g' } }),
        'stream: a key that arrived is in the diff'
    );
}
GROUPS.push(testSkepticTime, testSkepticSeek, testSkepticHold, testSkepticStream);
