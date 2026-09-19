const ESC_CODE = 27;

function testPaint(core) {
    const esc = String.fromCharCode(ESC_CODE);
    const plain = text =>
        text
            .split(esc)
            .join('')
            .replace(/\[[0-9;]*m/g, '');
    const inked = (code, text) => `${esc}[${code}m${text}${esc}[0m`;
    const state = { title: 'Seven Samurai', artist: 'Kurosawa', position: 3961, duration: 12_420, playing: true };
    const line = core.paintStatus(state, { app: 'IINA', multiplier: 1 });
    same(plain(line), '▶ 1:06:01 / 3:27:00  ━━━━━───────────  Seven Samurai — Kurosawa  · IINA', 'painted: what is where, colours aside');
    same(line.includes(inked(1, '1:06:01')), true, 'painted: the position is bold');
    same(line.includes(inked(2, ' / 3:27:00')), true, 'painted: the length is dim');
    same(line.includes(inked(1, 'Seven Samurai')), true, 'painted: the title is bold');
    same(line.includes(inked(2, '· IINA')), true, 'painted: the app is dim');
    same(
        plain(core.paintStatus(state, { app: 'IINA', multiplier: 1, chapter: '6/13' })),
        '▶ 1:06:01 / 3:27:00  ━━━━━───────────  Seven Samurai — Kurosawa  ch 6/13  · IINA',
        'painted: the chapter, when the player tells it'
    );
    const paused = { ...state, playing: false };
    same(
        plain(core.paintStatus(paused, { app: 'IINA', multiplier: 1.6 })).endsWith('· IINA  ×1.6'),
        true,
        'painted: the multiplier closes the line'
    );
    same(plain(core.paintStatus(paused, { app: 'IINA', multiplier: 1 })).startsWith('⏸ '), true, 'painted: paused');
    const live = { ...state, duration: 0, artist: '' };
    same(
        plain(core.paintStatus(live, { app: 'Safari', multiplier: 1 })),
        '▶ 1:06:01  Seven Samurai  · Safari',
        'painted: a live stream has no length and no bar'
    );
    const ended = { ...state, position: 12_420 };
    same(
        plain(core.paintStatus(ended, { app: 'IINA', multiplier: 1 })).includes('━━━━━━━━━━━━━━━━  '),
        true,
        'painted: the bar is full at the end'
    );
    const start = { ...state, position: 0 };
    same(
        plain(core.paintStatus(start, { app: null, multiplier: 1 })),
        '▶ 00:00 / 3:27:00  ────────────────  Seven Samurai — Kurosawa',
        'painted: no app name, nothing in its place'
    );
}
function testPaintChange(core) {
    const esc = String.fromCharCode(ESC_CODE);
    const inked = (code, text) => `${esc}[${code}m${text}${esc}[0m`;
    const plain = text =>
        text
            .split(esc)
            .join('')
            .replace(/\[[0-9;]*m/g, '');
    const state = { title: 'Seven Samurai', artist: 'Kurosawa', position: 3961, duration: 12_420, playing: false };
    same(
        core.paintChange({ icon: '×', words: 'nothing is playing' }, '12:30:05', null, null),
        `${inked(2, '12:30:05')}  ${inked(31, '×')} ${inked(1, 'nothing is playing')}`,
        'log: the clock dim, the sign in its colour, what happened bold'
    );
    same(
        plain(core.paintChange({ icon: '♪', words: 'Seven Samurai — Kurosawa' }, '12:30:05', state, 'IINA')),
        '12:30:05  ♪ Seven Samurai — Kurosawa  · IINA',
        'log: a new item is named, with its app'
    );
    same(
        plain(core.paintChange({ icon: '⏸', words: 'paused', label: 'paused' }, '12:30:05', state, 'IINA')),
        '12:30:05  ⏸ paused   1:06:01 / 3:27:00  ━━━━━───────────',
        'log: a pause says where it happened, so the line stands alone'
    );
    same(
        plain(core.paintChange({ icon: '⇥', words: 'seeked to 1:06:01', label: 'seeked' }, '12:30:05', state, 'IINA')),
        '12:30:05  ⇥ seeked   1:06:01 / 3:27:00  ━━━━━───────────',
        'log: a seek lines up under it'
    );
    same(
        plain(core.paintChange({ icon: '▶', label: 'playing' }, '12:30:05', { ...state, duration: 0 }, 'Safari')),
        '12:30:05  ▶ playing  1:06:01',
        'log: a live stream has no length and no bar'
    );
}
function testPaintText(core) {
    const esc = String.fromCharCode(ESC_CODE);
    const plain = text =>
        text
            .split(esc)
            .join('')
            .replace(/\[[0-9;]*m/g, '');
    const inked = (code, text) => `${esc}[${code}m${text}${esc}[0m`;
    const usage = [
        'tool 1.0 — what it is',
        '',
        'Move',
        '  seek <time>      to a place: seek 754',
        '  forward [time]',
        '    <time> is seconds or a clock',
        '  play | pause',
        '',
        'exit codes: 0 done · 2 not',
    ].join('\n');
    const painted = core.paintUsage(usage);
    same(plain(painted), usage, 'usage: paint adds no character and takes none away');
    same(painted.includes(inked(33, 'Move')), true, 'usage: a heading is yellow');
    same(painted.includes(`${inked(36, 'seek')} ${inked(2, '<time>')}`), true, 'usage: the word is in the accent, its argument dim');
    same(painted.includes('to a place: seek 754'), true, 'usage: what it does is left alone');
    same(painted.startsWith(inked(1, 'tool 1.0')), true, 'usage: the name and version are bold');
    same(painted.includes(inked(2, '    <time> is seconds or a clock')), true, 'usage: a note, indented further, is dim as a whole');
    same(
        painted.includes(`${inked(36, 'play')} ${inked(2, '|')} ${inked(36, 'pause')}`),
        true,
        'usage: a row of words is a row of commands'
    );

    const ini = ['; the file — not found', '', '[seek]', '; forward without a time', 'step = 10'].join('\n');
    const paintedIni = core.paintIni(ini);
    same(plain(paintedIni), ini, 'ini: paint adds no character and takes none away');
    same(paintedIni.includes(inked(2, '; forward without a time')), true, 'ini: a comment is dim');
    same(paintedIni.includes(inked(33, '[seek]')), true, 'ini: a section is yellow, as a heading is');
    same(paintedIni.includes(`${inked(36, 'step')} = 10`), true, 'ini: a key is in the accent');
}
function testPaintJson(core) {
    const esc = String.fromCharCode(ESC_CODE);
    const plain = text =>
        text
            .split(esc)
            .join('')
            .replace(/\[[0-9;]*m/g, '');
    const inked = (code, text) => `${esc}[${code}m${text}${esc}[0m`;
    const value = { title: 'Seven "Samurai"', artist: null, playing: true, position: 3961.5, nested: { a: [1, 'two'] } };
    const painted = core.paintJson(value);
    same(plain(painted), JSON.stringify(value, null, 2), 'json: the same text as a pretty print, colours aside');
    same(JSON.stringify(JSON.parse(plain(painted))), JSON.stringify(value), 'json: and it still parses');
    same(
        painted.includes(`${inked(34, '"title"')}: ${inked(32, '"Seven \\"Samurai\\""')}`),
        true,
        'json: a key is blue, a string is green'
    );
    same(painted.includes(`${inked(34, '"artist"')}: ${inked(2, 'null')}`), true, 'json: null is dim');
    same(painted.includes(`${inked(34, '"position"')}: ${inked(33, '3961.5')}`), true, 'json: a number is yellow');
    same(painted.includes(`${inked(34, '"playing"')}: ${inked(35, 'true')}`), true, 'json: a flag is magenta');
}
GROUPS.push(testPaint, testPaintChange, testPaintText, testPaintJson);
