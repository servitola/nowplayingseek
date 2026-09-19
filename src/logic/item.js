const FIRST = [
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
const ARTWORK = 'Artwork';

// What one looks for first comes first; the four artwork keys fold into one object at the end.
function orderRaw(raw) {
    const ordered = {};
    const artwork = {};
    const rest = Object.keys(raw).filter(key => !FIRST.includes(key));
    for (const key of [...FIRST.filter(name => Object.hasOwn(raw, name)), ...rest.sort()]) {
        if (key.startsWith(ARTWORK)) {
            artwork[key.slice(ARTWORK.length)] = raw[key];
        } else {
            ordered[key] = raw[key];
        }
    }
    return Object.keys(artwork).length > 0 ? { ...ordered, [ARTWORK]: artwork } : ordered;
}

function formatChapter(raw) {
    if (isMissing(raw.ChapterNumber)) {
        return null;
    }
    return isMissing(raw.TotalChapterCount) ? String(raw.ChapterNumber) : `${raw.ChapterNumber}/${raw.TotalChapterCount}`;
}
