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
GROUPS.push(testPaint);
