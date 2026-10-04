// Appended to src/logic/time.js + item.js + paint.js: prints the README demo with the real painters.
function run() {
    const state = { title: 'Seven Samurai', artist: '', album: '', app: 'org.videolan.vlc', duration: 12420, position: 1857.4, playing: true, rate: 1, timestamp: 1789768358.106 };
    const back = { ...state, position: 1852.4 };
    const there = { ...state, position: 3723 };
    const still = { ...there, playing: false, rate: 0 };
    const notes = humanNotes(there, { appName: 'VLC', localTime: () => '19 Sep 2026 at 10:45:37' });
    return [
        '$ nowplayingseek status', paintStatus(state, { app: 'VLC', multiplier: 1, chapter: '3/12' }), '',
        '$ nowplayingseek backward', paintStatus(back, { app: 'VLC', multiplier: 1, chapter: '3/12' }), '',
        '$ nowplayingseek seek 1:02:03', paintStatus(there, { app: 'VLC', multiplier: 1, chapter: '5/12' }), '',
        '$ nowplayingseek pause', paintStatus(still, { app: 'VLC', multiplier: 1, chapter: '5/12' }), '',
        '$ nowplayingseek status --json', paintJson(withHuman(still, notes)),
    ].join('\n');
}
