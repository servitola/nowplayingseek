const IDENTITY = ['title', 'artist', 'album', 'app'];
const LEAP = 2;

const named = state => [state.title, state.artist].filter(Boolean).join(' — ');

function describeChange(previous, current, started = false) {
    if (!current) {
        return previous ? { icon: '×', words: 'nothing is playing' } : null;
    }
    if (!previous) {
        return started ? { icon: '♪', words: named(current) } : null;
    }
    if (IDENTITY.some(key => previous[key] !== current[key])) {
        return { icon: '♪', words: named(current) };
    }
    if (previous.playing !== current.playing) {
        return current.playing ? { icon: '▶', words: 'played', label: 'played' } : { icon: '⏸', words: 'paused', label: 'paused' };
    }
    const expected = previous.position + (previous.rate || 0) * (current.at - previous.at);
    return Math.abs(current.position - expected) > LEAP
        ? { icon: '⇥', words: `seeked to ${formatTime(current.position)}`, label: 'seeked' }
        : null;
}

const describeState = state => (state.playing ? { icon: '▶', label: 'playing' } : { icon: '⏸', label: 'paused' });

// A new item logs two lines: what it is, then what it is doing.
function logOf(change, current) {
    return change.label || !current ? [change] : [change, describeState(current)];
}
