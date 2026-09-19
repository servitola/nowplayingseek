function testDescribeChange(core) {
    const playing = { title: 'Seven Samurai', artist: 'Kurosawa', album: '', app: 'vlc', position: 100, rate: 1, playing: true, at: 50 };
    const words = change => (change ? `${change.icon} ${change.words}` : null);
    same(words(core.describeChange(null, playing)), null, 'watch: starting up is not an event');
    same(words(core.describeChange(playing, { ...playing, position: 101, at: 51 })), null, 'watch: a second of playing is not an event');
    same(words(core.describeChange(playing, { ...playing, playing: false, rate: 0, position: 101, at: 51 })), '⏸ paused', 'watch: paused');
    const paused = { ...playing, playing: false, rate: 0 };
    same(words(core.describeChange(paused, { ...playing, at: 51 })), '▶ played', 'watch: played');
    same(
        words(core.describeChange(playing, { ...playing, position: 161, at: 51 })),
        '⇥ seeked to 02:41',
        'watch: a leap forward is a seek'
    );
    same(words(core.describeChange(playing, { ...playing, position: 40, at: 51 })), '⇥ seeked to 00:40', 'watch: and a leap back');
    same(
        words(core.describeChange(paused, { ...paused, position: 100, at: 80 })),
        null,
        'watch: a paused item that stays put is not an event'
    );
    same(
        words(core.describeChange(playing, { ...playing, title: 'Ran', position: 0, at: 51 })),
        '♪ Ran — Kurosawa',
        'watch: another title is a new item, whatever else changed'
    );
    same(
        words(core.describeChange(playing, { ...paused, app: 'iina', at: 51 })),
        '♪ Seven Samurai — Kurosawa',
        'watch: another app is a new item'
    );
    same(words(core.describeChange(playing, null)), '× nothing is playing', 'watch: it went away');
    same(words(core.describeChange(null, null)), null, 'watch: still nothing');
    same(words(core.describeChange(null, playing, true)), '♪ Seven Samurai — Kurosawa', 'watch: something after nothing is a new item');
}

function testFit(core) {
    same(core.fitToWidth('Seven Samurai', 20), 'Seven Samurai', 'fit: short enough is left alone');
    same(core.fitToWidth('Seven Samurai', 8), 'Seven S…', 'fit: cut to the width, the ellipsis counted');
    same(core.fitToWidth('七人の侍🎬film', 5), '七人の侍…', 'fit: a character is never cut in half');
    same(core.fitToWidth('Seven', 0), '', 'fit: no room, nothing');
    same(core.parseColumns('24 80\n'), 80, 'columns: what stty size says');
    same(core.parseColumns(''), 80, 'columns: no terminal to ask, a plain 80');
    same(core.parseColumns('garbage'), 80, 'columns: nonsense, a plain 80');
    const esc = String.fromCharCode(27);
    same(core.visibleLength(`${esc}[1mSeven${esc}[0m ${esc}[2m·${esc}[0m`), 7, 'fit: paint has no width');
    const state = {
        title: 'A very long title that would wrap on a narrow terminal',
        artist: '',
        position: 61,
        duration: 600,
        playing: true,
    };
    const line = core.paintStatus(state, { app: 'VLC', multiplier: 1, columns: 60 });
    same(core.visibleLength(line) <= 60, true, 'fit: the painted status keeps to the width');
    same(line.includes('…'), true, 'fit: and says it cut the title');
    same(core.visibleLength(core.paintStatus(state, { app: 'VLC', multiplier: 1 })) > 60, true, 'fit: no width given, nothing cut');
}
GROUPS.push(testDescribeChange, testFit);
