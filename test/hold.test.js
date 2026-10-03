function testKnob(core) {
    const click = { target: 110, at: 50, direction: 1 };
    same(core.knobRate(null, 1, 50, 1), 0, 'knob: the first click has no pace yet');
    same(core.knobRate(click, 1, 50.05, 1), 20, 'knob: 50 ms after a click is 20 a second');
    same(core.knobRate(click, -1, 50.05, 1), 0, 'knob: the other way starts over');
    same(core.knobRate(click, 1, 51.5, 1), 0, 'knob: a pause longer than the gap starts over');
    same(core.knobRate(click, 1, 50, 1), 100, 'knob: two clicks at the same instant do not divide by zero');

    const knob = { max_multiplier: 4, slow: 18, fast: 32 };
    same(core.knobMultiplier(0, knob), 1, 'knob: a single click is one step');
    same(core.knobMultiplier(16, knob), 1, 'knob: a careful turn stays one step a click');
    same(core.knobMultiplier(18, knob), 1, 'knob: up to slow, one step');
    same(core.knobMultiplier(25, knob), 2.5, 'knob: halfway between slow and fast, halfway to max_multiplier');
    same(core.knobMultiplier(32, knob), 4, 'knob: at fast, max_multiplier');
    same(core.knobMultiplier(100, knob), 4, 'knob: a flick settles at max_multiplier');
    same(core.knobMultiplier(29, { ...knob, slow: 30, fast: 20 }), 1, 'knob: fast below slow is a step at slow, below it one step');
    same(core.knobMultiplier(31, { ...knob, slow: 30, fast: 20 }), 4, 'knob: and above it max_multiplier');
}

function testHold(core) {
    const mine = { holder: 'a' };
    same(core.holdContinues(mine, 'a', null, 50), true, 'hold: nobody took over, nothing released');
    same(core.holdContinues({ holder: 'b' }, 'a', null, 50), false, 'hold: another press took over');
    same(core.holdContinues(null, 'a', null, 50), false, 'hold: the record is gone');
    same(core.holdContinues(mine, 'a', { releasedAt: 51 }, 50), false, 'hold: this key was released');
    same(core.holdContinues(mine, 'a', { releasedAt: 49 }, 50), true, 'hold: a release older than the press is not ours');

    same(core.releasedSince({ releasedAt: 50.2 }, 50), true, 'tap: the release beat the press to the record');
    same(core.releasedSince({ releasedAt: 49 }, 50), false, 'an old release does not stop a new press');
    same(core.releasedSince({ holder: 'b' }, 50), false, 'a running hold is not a release');
    same(core.releasedSince(null, 50), false, 'no record, no release');

    same(core.nextHoldTarget(100, 10, 2, 600), 120, 'hold: a step times the multiplier');
    same(core.nextHoldTarget(590, 10, 1, 600), 595, 'a step forward stops 5 s short of the end, so the item does not end');
    same(core.nextHoldTarget(595, 10, 1, 600), null, 'nothing further there');
    same(core.nextHoldTarget(598, 10, 1, 600), null, 'and a step forward never moves back');
    same(core.nextHoldTarget(598, -10, 1, 600), 588, 'backward from the very end is a plain step');
    same(core.nextHoldTarget(1, 10, 1, 3), null, 'an item shorter than the margin is left alone');
    same(core.nextHoldTarget(0, -10, 3, 600), null, 'hold: nothing further at the start');
    same(core.nextHoldTarget(100, 10, 1, 0), 110, 'hold: a live stream has no end');
}
function testStream(core) {
    const song = { processIdentifier: 7, bundleIdentifier: 'a', title: 'One', artist: 'X', playing: true, elapsedTime: 10 };
    const json = value => JSON.stringify(value);
    same(json(core.streamChange(null, song, true)), json({ diff: false, payload: song }), 'stream: the first item is sent whole');
    same(core.streamChange(song, { ...song }, true), null, 'stream: nothing changed, nothing sent');
    same(
        json(core.streamChange(song, { ...song, playing: false, elapsedTime: 12 }, true)),
        json({ diff: true, payload: { playing: false, elapsedTime: 12 } }),
        'stream: the same item sends only what changed'
    );
    const { artist: _artist, ...gone } = song;
    same(
        json(core.streamChange(song, gone, true)),
        json({ diff: false, payload: gone }),
        'stream: an artist that vanished makes it another item'
    );
    same(
        json(core.streamChange(song, { ...song, title: 'Two' }, true)),
        json({ diff: false, payload: { ...song, title: 'Two' } }),
        'stream: another title is another item, sent whole'
    );
    same(
        json(core.streamChange({ ...song, genre: 'g' }, song, true)),
        json({ diff: true, payload: { genre: null } }),
        'stream: a key that went away is null in the diff'
    );
    same(
        json(core.streamChange(song, { ...song, playing: false }, false)),
        json({ diff: false, payload: { ...song, playing: false } }),
        'stream: --no-diff always sends it whole'
    );
    same(
        json(core.streamChange(song, null, true)),
        json({ diff: false, payload: {} }),
        'stream: nothing playing any more is an empty payload'
    );
    same(core.streamChange(null, null, true), null, 'stream: still nothing');
}
GROUPS.push(testKnob, testHold, testStream);
