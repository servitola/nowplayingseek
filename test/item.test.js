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
GROUPS.push(testChapters, testRaw);
