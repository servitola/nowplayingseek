function testKnob(core) {
    const click = { target: 110, at: 50, direction: 1, rate: 10 };
    same(core.knobRate(null, 1, 50, 1), 0, 'knob: the first click has no pace yet');
    same(core.knobRate(click, 1, 50.05, 1), 15, 'knob: 50 ms after a click at 10 a second — halfway to 20 a second');
    same(core.knobRate(click, -1, 50.05, 1), 0, 'knob: the other way starts over');
    same(core.knobRate(click, 1, 51.5, 1), 0, 'knob: a pause longer than the gap starts over');
    same(core.knobRate({ ...click, rate: undefined }, 1, 50.1, 1), 5, 'knob: after a key press, not a click');
    same(core.knobRate(click, 1, 50, 1), 55, 'knob: two clicks at the same instant do not divide by zero');

    const knob = { max_multiplier: 4, fast: 12 };
    same(core.knobMultiplier(0, knob), 1, 'knob: a single click is one step');
    same(core.knobMultiplier(2, knob) < 1.1, true, 'knob: slow clicks stay precise');
    same(core.knobMultiplier(12, knob), 1 + 3 * (1 - Math.exp(-1)), 'knob: at fast it is 63 % of the way');
    same(core.knobMultiplier(100, knob), 4, 'knob: a flick settles at max_multiplier');
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
GROUPS.push(testKnob, testHold);
