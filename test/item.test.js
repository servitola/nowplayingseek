function testChapters(core) {
    same(core.formatChapter(JSON.parse('{"ChapterNumber":6,"TotalChapterCount":13}')), '6/13', 'chapter: number of total');
    same(core.formatChapter(JSON.parse('{"ChapterNumber":6}')), '6', 'chapter: a number alone');
    same(core.formatChapter({}), null, 'chapter: none');
}

function testRaw(core) {
    const raw = JSON.parse(
        '{"app":"a","playing":true,"ArtworkDataWidth":768,"ArtworkMIMEType":"image/jpeg","Zeta":1,"Title":"T","Duration":9,"ChapterNumber":6,"AssetURL":"file:///x"}'
    );
    const ordered = core.orderRaw(raw);
    same(
        JSON.stringify(Object.keys(ordered)),
        JSON.stringify(['app', 'playing', 'Title', 'Duration', 'ChapterNumber', 'AssetURL', 'Zeta', 'Artwork']),
        'raw: what one looks for first comes first, the rest by the alphabet, the artwork last'
    );
    same(JSON.stringify(ordered.Artwork), '{"DataWidth":768,"MIMEType":"image/jpeg"}', 'raw: the artwork keys are one object');
    same(Object.hasOwn(core.orderRaw(JSON.parse('{"app":"a","Title":"T"}')), 'Artwork'), false, 'raw: no artwork, no empty object');
}
function testNotes(core) {
    const raw = JSON.parse(
        [
            '{"app":"com.colliderli.iina","Duration":11750.05,"ElapsedTime":5926.45,"PlaybackRate":1,',
            '"Timestamp":"2026-09-19T07:45:37.261Z",',
            '"MediaType":"kMRMediaRemote',
            'NowPlayingInfoTypeVideo",',
            '"AssetURL":"file:///Users/me/UFC%20Fight%20Night.mp4"}',
        ].join('')
    );
    const notes = core.humanNotes(raw, { appName: 'IINA', localTime: () => '19 Sep 2026, 10:45:37' });
    same(notes.Duration, '3:15:50', 'notes: a length as a clock');
    same(notes.ElapsedTime, '1:38:46', 'notes: a position as a clock');
    same(notes.Timestamp, '19 Sep 2026, 10:45:37', 'notes: the time as this Mac writes it');
    same(notes.MediaType, 'video', 'notes: the media type in a word');
    same(notes.AssetURL, '/Users/me/UFC Fight Night.mp4', 'notes: a file URL as a path');
    same(notes.app, 'IINA', 'notes: the app by its name');
    same(Object.hasOwn(notes, 'PlaybackRate'), false, 'notes: nothing to add to a plain number');
    const state = { app: 'org.videolan.vlc', duration: 300, position: 95.5, timestamp: 1_789_768_358.106 };
    const forState = core.humanNotes(state, { appName: 'VLC', localTime: () => 'then' });
    same(
        `${forState.duration} ${forState.position} ${forState.timestamp} ${forState.app}`,
        '05:00 01:35 then VLC',
        'notes: the same for status --json'
    );
}
function testValidJson(core) {
    const esc = String.fromCharCode(27);
    const plain = text =>
        text
            .split(esc)
            .join('')
            .replace(/\[[0-9;]*m/g, '');
    const state = { title: 'A "quoted" title', app: 'org.videolan.vlc', duration: 300, position: 95.5, playing: true };
    const shown = core.withHuman(state, core.humanNotes(state, { appName: 'VLC', localTime: () => 'then' }));
    same(
        JSON.stringify(shown.human),
        '{"duration":"05:00","position":"01:35","app":"VLC"}',
        'human: what a person reads is one object of its own'
    );
    same(shown.position, 95.5, 'human: what a program reads is untouched');
    same(JSON.stringify(Object.keys(shown)), JSON.stringify([...Object.keys(state), 'human']), 'human: it comes last');
    same(
        JSON.stringify(JSON.parse(plain(core.paintJson(shown)))),
        JSON.stringify(shown),
        'copied from a terminal, the painted JSON is the same valid JSON'
    );
    same(Object.hasOwn(core.withHuman({ rate: 1 }, {}), 'human'), false, 'human: nothing to say, no empty object');
}
GROUPS.push(testChapters, testRaw, testNotes, testValidJson);
