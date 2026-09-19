function testDialectWords(core) {
    const json = value => JSON.stringify(value);
    same(json(core.playerctlPosition('30+')), json({ by: 30 }), 'playerctl: 30+ is thirty forward');
    same(json(core.playerctlPosition('7.5-')), json({ by: -7.5 }), 'playerctl: 7.5- is seven and a half back');
    same(json(core.playerctlPosition('90')), json({ to: 90 }), 'playerctl: a bare number is a place');
    same(core.playerctlPosition('+30'), null, 'playerctl: the sign goes after the number');
    same(core.playerctlPosition('soon'), null, 'playerctl: a word is nothing');

    same(json(core.mpcSeek('+10', 300)), json({ by: 10 }), 'mpc: +10 is ten forward');
    same(json(core.mpcSeek('-00:00:02', 300)), json({ by: -2 }), 'mpc: -00:00:02 is two back');
    same(json(core.mpcSeek('1:30', 300)), json({ to: 90 }), 'mpc: 1:30 is a place');
    same(json(core.mpcSeek('50%', 300)), json({ to: 150 }), 'mpc: 50% is the middle');
    same(json(core.mpcSeek('+10%', 300)), json({ by: 30 }), 'mpc: +10% is a tenth forward');
    same(core.mpcSeek('later', 300), null, 'mpc: a word is nothing');
    same(core.mpcSeek('50%', 0), null, 'mpc: a percentage of an unknown length is nothing, not the start');
    same(JSON.stringify(core.mpcSeek('+10', 0)), JSON.stringify({ by: 10 }), 'mpc: seconds need no length');
    same(core.mpcSeek('1:75', 300), null, 'mpc: seventy-five seconds is not a clock');

    const fields = { artist: 'Hayasaka', title: 'Seven Samurai', album: '', status: 'Playing', position: 65_500_000, playerName: 'vlc' };
    same(
        core.playerctlFormat('{{ artist }} - {{title}}', fields),
        'Hayasaka - Seven Samurai',
        'playerctl: a template with and without spaces'
    );
    same(
        core.playerctlFormat('{{ duration(position) }} {{ uc(status) }} {{ lc(artist) }}', fields),
        '1:05 PLAYING hayasaka',
        'playerctl: duration, uc, lc'
    );
    same(core.playerctlFormat('[{{ album }}{{ nosuch }}]', fields), '[]', 'playerctl: what is not there is empty');
    same(core.clock(3725.9), '62:05', 'a clock counts minutes past the hour, as mpc and shpotify do');
}
GROUPS.push(testDialectWords);
