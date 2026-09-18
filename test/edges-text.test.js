function testSkepticItem(core) {
    const first = [
        'app',
        'playing',
        'Title',
        'Artist',
        'Album',
        'Duration',
        'ElapsedTime',
        'PlaybackRate',
        'Timestamp',
        'ChapterNumber',
        'TotalChapterCount',
        'MediaType',
    ];
    const raw = { AssetURL: 'u' };
    for (const key of [...first].reverse()) {
        raw[key] = 1;
    }
    same(JSON.stringify(Object.keys(core.orderRaw(raw))), JSON.stringify([...first, 'AssetURL']), 'raw: the whole reading order');

    const tools = { appName: null, localTime: () => 'then' };
    same(
        Object.hasOwn(core.humanNotes({ Duration: 'soon' }, tools), 'Duration'),
        false,
        'notes: a length that is not a number gets no clock'
    );
    same(Object.hasOwn(core.humanNotes({ app: 'a' }, tools), 'Timestamp'), false, 'notes: no moment, no note');
    same(Object.hasOwn(core.humanNotes({ AssetURL: 'https://x/y.mp4' }, tools), 'AssetURL'), false, 'notes: only a file URL is a path');
    same(Object.hasOwn(core.humanNotes({ app: 'a' }, tools), 'app'), false, 'notes: no app name, no note');
    same(
        Object.hasOwn(core.humanNotes({ Title: 'T' }, { ...tools, appName: 'IINA' }), 'app'),
        false,
        'notes: no app in the values, no note'
    );
}

function testSkepticWords(core) {
    same(core.clock(59), '0:59', 'a clock under a minute');
    same(
        failureOf(core, () => core.playerctlFormat('{{ toString(title) }}', { title: 'T' })),
        "64: nowplayingseek does not know the helper toString() of playerctl's format strings",
        'playerctl: a word every object has is still no helper'
    );
}

function testSkepticPaint(core) {
    const esc = String.fromCharCode(27);
    const plain = text =>
        text
            .split(esc)
            .join('')
            .replace(/\[[0-9;]*m/g, '');
    const inked = (code, text) => `${esc}[${code}m${text}${esc}[0m`;
    const state = { title: 'Seven Samurai', artist: 'Kurosawa', position: 3961, duration: 12_420, playing: true };
    const line = core.paintStatus(state, { app: 'IINA', multiplier: 1.6, chapter: '6/13' });
    same(line.includes(inked(32, '▶')), true, 'painted: playing is green');
    same(line.includes(inked(32, '━━━━━') + inked(2, '───────────')), true, 'painted: the bar is green as well, then dim');
    const pausedLine = core.paintStatus({ ...state, playing: false }, { app: 'IINA', multiplier: 1 });
    same(pausedLine.includes(inked(33, '⏸')) && pausedLine.includes(inked(33, '━━━━━')), true, 'painted: paused is yellow, icon and bar');
    same(line.includes(`${inked(1, 'Seven Samurai')} — Kurosawa`), true, 'painted: the artist is plain');
    same(line.includes(inked(36, 'ch 6/13')), true, 'painted: the chapter is in the accent');
    same(line.includes(inked(33, '×1.6')), true, 'painted: the multiplier is a number, yellow');
    same(
        plain(core.paintStatus({ ...state, position: 15, duration: 160 }, { app: null, multiplier: 1 })).includes('  ━━──────────────  '),
        true,
        'painted: a cell and a half rounds to two'
    );
    same(
        plain(core.paintStatus({ ...state, position: 13_000 }, { app: null, multiplier: 1 })).includes('  ━━━━━━━━━━━━━━━━  '),
        true,
        'painted: a position past the end is a full bar, not a crash'
    );
    same(
        plain(core.paintStatus({ ...state, position: null }, { app: null, multiplier: 1 })).includes('  ────────────────  '),
        true,
        'painted: an unknown position is an empty bar'
    );
    same(
        plain(core.paintStatus({ position: 5, duration: 0, playing: true }, { app: 'X', multiplier: 1 })),
        '▶ 00:05  · X',
        'painted: no title and no artist, nothing in their place'
    );

    const painted = core.paintUsage(['tool 1.0 — what it is', '', '  forward [time]', '', 'exit codes: 0 done'].join('\n'));
    same(painted.includes(`${inked(36, 'forward')} ${inked(2, '[time]')}`), true, 'usage: an optional argument is dim');
    same(painted.split('\n')[1], '', 'usage: an empty line stays empty');
    same(painted.endsWith(`${inked(1, 'exit codes:')} 0 done`), true, 'usage: only the label of a labelled line is bold');
    same(core.paintIni('# mine'), inked(2, '# mine'), 'ini: a # comment is dim too');

    const json = core.paintJson({ off: false, on: true, below: -1 });
    same(
        json.includes(inked(35, 'false')) && json.includes(inked(35, 'true')) && json.includes(inked(33, '-1')),
        true,
        'json: false and true are magenta, a negative number is yellow like any number'
    );
    same(plain(core.paintJson({ nested: { a: 1 } }, { a: 'no' })).includes('no'), false, 'json: a note is for the top level only');
    same(plain(core.paintJson({ toString: 1 }, {})), '{\n  "toString": 1\n}', 'json: a key every object has gets no note');
    same(core.paintError('x'), inked(31, 'x'), 'an error is in the alarm colour');
}

function testSkepticConfig(core) {
    const defaults = core.resolveSettings([]);
    same(
        JSON.stringify(defaults.values),
        '{"seek":{"step":10},"progressive":{"max_multiplier":2.5,"start":0.4,"ramp":6,"streak_gap":1},"knob":{"step":2,"max_multiplier":4,"fast":18},"hold":{"interval":0.2,"max_time":60},"watch":{"interval":1},"timing":{"verify_timeout":2.5,"pending_seek_max":3,"command_delivery":0.3,"poll_interval":0.03}}',
        'settings: every default'
    );
    const prototypeKey = core.resolveSettings(core.parseIni('[seek]\nconstructor = 5'));
    same(
        prototypeKey.warnings[0],
        'line 2: unknown setting [seek] constructor — ignored',
        'settings: a key every object has is unknown too'
    );
    same(prototypeKey.values.seek.step, 10, 'settings: it does not smuggle in through the prototype chain');
    const printed = core.formatSettings(defaults.texts);
    same(
        printed.startsWith('[seek]\n; forward / backward without a time\nstep = 10\n\n[progressive]\n; forward / backward --progressive'),
        true,
        'settings: the printed config explains each key, a blank line between sections'
    );
    same(
        printed.includes('settles at this many times its size\nmax_multiplier = 2.5\n\n; a held key glides off'),
        true,
        'settings: a blank line between keys'
    );
}
GROUPS.push(testSkepticItem, testSkepticWords, testSkepticPaint, testSkepticConfig);
