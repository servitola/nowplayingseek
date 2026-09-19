function testMultiplier(core) {
    const curve = { start: 0.4, max_multiplier: 3, ramp: 5 };
    same(core.multiplierAt(0, curve, false), 1, 'a tap is exactly one step');
    same(core.multiplierAt(1, curve, false), 1, 'separate presses never shrink below one step');
    same(core.multiplierAt(0.2, curve, true) < 0.5, true, 'a held key glides off in small steps');
    same(core.multiplierAt(5, curve, true), 0.4 + 2.6 * (1 - Math.exp(-1)), 'at ramp it is 63 % of the way');
    same(core.multiplierAt(60, curve, true), 3, 'it settles at max_multiplier');
    same(core.multiplierAt(2.2, curve, true) > core.multiplierAt(2, curve, true), true, 'every step is longer than the last');
    same(core.multiplierAt(60, { start: 1, max_multiplier: 1, ramp: 5 }, true), 1, 'start 1 and max 1 switch it off');
}

function testIni(core) {
    const ini = '; comment\n# another\n\n[seek]\nstep = 1:30\r\n [ progressive ] \nramp=3\n';
    same(
        JSON.stringify(core.parseIni(ini)),
        JSON.stringify([
            { section: 'seek', key: 'step', text: '1:30', line: 5 },
            { section: 'progressive', key: 'ramp', text: '3', line: 7 },
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
    const ini = '; comment\n# another\n\n[seek]\nstep = 1:30\r\n [ progressive ] \nramp=3\n';
    const defaults = core.resolveSettings([]);
    same(defaults.values.seek.step, 10, 'settings: default step');
    same(defaults.values.timing.poll_interval, 0.03, 'settings: default poll interval');
    same(defaults.values.hold.interval, 0.2, 'settings: default hold interval');
    same(defaults.values.hold.max_time, 60, 'settings: default hold fuse');
    same(defaults.values.watch.interval, 1, 'settings: watch redraws once a second');
    same(defaults.values.knob.step, 2, 'settings: default knob step');
    same(defaults.values.knob.fast, 18, 'settings: default knob pace');
    same(defaults.values.progressive.max_multiplier, 2.5, 'settings: default max multiplier');
    same(defaults.values.progressive.ramp, 6, 'settings: default ramp');
    same(defaults.values.progressive.start, 0.4, 'settings: default start');
    const custom = core.resolveSettings(core.parseIni(ini));
    same(custom.values.seek.step, 90, 'settings: step accepts mm:ss');
    same(custom.values.progressive.ramp, 3, 'settings: ramp from the file');
    same(custom.values.progressive.streak_gap, 1, 'settings: untouched keys keep their defaults');
    same(
        failureOf(core, () => core.resolveSettings(core.parseIni('[seek]\nstep = 0'))),
        '78: line 2: [seek] step = "0" — expected seconds or mm:ss above zero',
        'settings: bad value'
    );
    same(
        failureOf(core, () => core.resolveSettings(core.parseIni('[progressive]\nmax_multiplier = 1:30'))),
        '78: line 2: [progressive] max_multiplier = "1:30" — expected a number above zero',
        'settings: a clock is not a multiplier'
    );
    same(
        failureOf(core, () => core.resolveSettings(core.parseIni('[hold]\ninterval = 1:30'))),
        '78: line 2: [hold] interval = "1:30" — expected seconds above zero',
        'settings: nor a pause between steps'
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
function testTemplate(core) {
    const template = core.settingsTemplate();
    same(core.parseIni(template).length, 0, 'template: nothing in it is in force, so a later default still reaches its owner');
    same(template.includes('; step = 10'), true, 'template: every key is there, commented, with its default');
    same(template.includes('[hold]'), true, 'template: the sections are real');
    const uncommented = template.replace('; step = 10', 'step = 7');
    same(core.resolveSettings(core.parseIni(uncommented)).values.seek.step, 7, 'template: uncomment a line and it is in force');
}
function testSet(core) {
    const set = (text, name, value) => core.withSetting(text, core.settingAssignment(name, value));
    const read = text => core.resolveSettings(core.parseIni(text)).values;
    same(read(set(core.settingsTemplate(), 'knob.fast', '24')).knob.fast, 24, 'set: uncomments the line init wrote');
    same(core.parseIni(set(core.settingsTemplate(), 'knob.fast', '24')).length, 1, 'set: and leaves every other default commented');
    same(set('[knob]\nfast = 18\n', 'knob.fast', '24'), '[knob]\nfast = 24\n', 'set: a live line is changed in place');
    same(
        set('[knob]\nfast = 18\n; fast = 9\n', 'knob.fast', '24'),
        '[knob]\nfast = 24\n; fast = 9\n',
        'set: the live line wins over a comment'
    );
    same(
        set('[seek]\nstep = 5\n\n[knob]\nfast = 18\n', 'knob.step', '3'),
        '[seek]\nstep = 5\n\n[knob]\nfast = 18\nstep = 3\n',
        'set: a new key joins its section'
    );
    same(
        set('[knob]\nfast = 18\n\n[hold]\ninterval = 1\n', 'knob.step', '3'),
        '[knob]\nfast = 18\nstep = 3\n\n[hold]\ninterval = 1\n',
        'set: not the section after it'
    );
    same(set('[seek]\nstep = 5\n', 'knob.step', '3'), '[seek]\nstep = 5\n\n[knob]\nstep = 3\n', 'set: a missing section is added');
    same(set('', 'knob.step', '1:30'), '[knob]\nstep = 1:30\n', 'set: an empty file gets the section alone');
    same(
        read(set('[knob]\n; comment = with an equals sign\n', 'seek.step', '7')).seek.step,
        7,
        'set: the same key in another section is another key'
    );
}

function testSetRefuses(core) {
    same(
        failureOf(core, () => core.settingAssignment('fast', '24')),
        '64: config set needs a setting such as knob.fast, got "fast"',
        'set: the section is part of the name'
    );
    same(
        failureOf(core, () => core.settingAssignment('knob.fats', '24')),
        '64: config set needs a setting such as knob.fast, got "knob.fats"',
        'set: unknown key'
    );
    same(
        failureOf(core, () => core.settingAssignment('toString.x', '1')),
        '64: config set needs a setting such as knob.fast, got "toString.x"',
        'set: unknown section'
    );
    same(
        failureOf(core, () => core.settingAssignment()),
        '64: config set needs a setting such as knob.fast, got ""',
        'set: nothing at all'
    );
    same(
        failureOf(core, () => core.settingAssignment('knob.fast', '0')),
        '64: config set knob.fast needs clicks a second above zero, got "0"',
        'set: a value that would not read back'
    );
    same(
        failureOf(core, () => core.settingAssignment('knob.fast')),
        '64: config set knob.fast needs clicks a second above zero, got ""',
        'set: no value'
    );
    same(
        failureOf(core, () => core.settingAssignment('hold.interval', '1:30')),
        '64: config set hold.interval needs seconds above zero, got "1:30"',
        'set: the same parser as the file'
    );
}
GROUPS.push(testMultiplier, testIni, testSettings, testTemplate, testSet, testSetRefuses);
