function testPattern(core) {
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
}

function testIni(core) {
    const ini = '; comment\n# another\n\n[seek]\nstep = 1:30\r\n [ progressive ] \npattern=3s:x4\n';
    same(
        JSON.stringify(core.parseIni(ini)),
        JSON.stringify([
            { section: 'seek', key: 'step', text: '1:30', line: 5 },
            { section: 'progressive', key: 'pattern', text: '3s:x4', line: 7 },
        ]),
        'ini: sections, comments, CRLF, spaces'
    );
    same(
        failureOf(core, () => core.parseIni('step = 5')),
        '78: line 1: expected "[section]" or "key = value" under one, got "step = 5"',
        'ini: key outside a section'
    );
    same(
        failureOf(core, () => core.parseIni('[seek]\nstep')),
        '78: line 2: expected "[section]" or "key = value" under one, got "step"',
        'ini: line without ='
    );
}

function testSettings(core) {
    const ini = '; comment\n# another\n\n[seek]\nstep = 1:30\r\n [ progressive ] \npattern=3s:x4\n';
    const defaults = core.resolveSettings([]);
    same(defaults.values.seek.step, 10, 'settings: default step');
    same(defaults.values.timing.poll_interval, 0.03, 'settings: default poll interval');
    same(defaults.values.hold.interval, 0.25, 'settings: default hold interval');
    same(defaults.values.hold.max_time, 30, 'settings: default hold fuse');
    same(
        core.multiplierAt(defaults.values.progressive.pattern, 10, defaults.values.progressive.max_multiplier),
        3,
        'settings: default pattern'
    );
    const custom = core.resolveSettings(core.parseIni(ini));
    same(custom.values.seek.step, 90, 'settings: step accepts mm:ss');
    same(custom.values.progressive.pattern.points[0].multiplier, 4, 'settings: pattern from the file');
    same(custom.values.progressive.streak_gap, 1, 'settings: untouched keys keep their defaults');
    same(
        failureOf(core, () => core.resolveSettings(core.parseIni('[seek]\nstep = 0'))),
        '78: line 2: [seek] step = "0" — expected seconds or mm:ss above zero',
        'settings: bad value'
    );
    same(
        failureOf(core, () => core.resolveSettings(core.parseIni('[seek]\nstpe = 5'))),
        '78: line 2: unknown setting [seek] stpe',
        'settings: unknown key'
    );
    same(
        failureOf(core, () => core.resolveSettings(core.parseIni('[toString]\nx = 5'))),
        '78: line 2: unknown setting [toString] x',
        'settings: unknown section'
    );
    same(
        JSON.stringify(core.resolveSettings(core.parseIni(core.formatSettings(custom.texts))).values),
        JSON.stringify(custom.values),
        'settings: the printed config reads back the same'
    );
}
GROUPS.push(testPattern, testIni, testSettings);
