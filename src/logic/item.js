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

const MEDIA_TYPE = /^kMRMediaRemoteNowPlayingInfoType/;
const FILE_URL = /^file:\/\//;
const CLOCKS = ['Duration', 'ElapsedTime', 'duration', 'position'];
const MOMENTS = ['Timestamp', 'timestamp'];

// What a person would write next to the value a program needs. Shown in a terminal only.
function humanNotes(values, { appName, localTime }) {
    const notes = {};
    for (const key of CLOCKS.filter(name => typeof values[name] === 'number')) {
        notes[key] = formatTime(values[key]);
    }
    for (const key of MOMENTS.filter(name => !isMissing(values[name]))) {
        notes[key] = localTime(values[key]);
    }
    if (typeof values.MediaType === 'string') {
        notes.MediaType = values.MediaType.replace(MEDIA_TYPE, '').toLowerCase();
    }
    if (FILE_URL.test(values.AssetURL || '')) {
        notes.AssetURL = decodeURIComponent(values.AssetURL.replace(FILE_URL, ''));
    }
    if (appName && values.app) {
        notes.app = appName;
    }
    return notes;
}

// Beside the values, not among them: whatever a person copies from the terminal stays valid JSON.
function withHuman(values, notes) {
    return Object.keys(notes).length > 0 ? { ...values, human: notes } : values;
}

const BASE64_CHARS_PER_GROUP = 4;
const BASE64_BYTES_PER_GROUP = 3;

function base64Padding(base64) {
    if (base64.endsWith('==')) {
        return 2;
    }
    return base64.endsWith('=') ? 1 : 0;
}

// The size of the bytes behind a base64 string; --human-readable shows this instead of the cover.
function base64ByteLength(base64) {
    return (base64.length / BASE64_CHARS_PER_GROUP) * BASE64_BYTES_PER_GROUP - base64Padding(base64);
}
