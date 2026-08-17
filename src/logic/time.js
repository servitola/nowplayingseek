const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

const MILLISECONDS_PER_SECOND = 1000;
const MICROSECONDS = 1e6;

const TIME_PATTERN = /^\d+(\.\d+)?$|^\d+(:[0-5]?\d){1,2}$/;
const EXIT = { ok: 0, nothingPlaying: 1, ignored: 2, usage: 64, config: 78 };

function Failure(code, message) {
    this.code = code;
    this.message = message;
}

const isMissing = value => value === null || value === undefined;

function parseTime(text) {
    if (!TIME_PATTERN.test(text)) {
        return null;
    }
    return text.split(':').reduce((total, part) => total * SECONDS_PER_MINUTE + Number.parseFloat(part), 0);
}

function formatTime(seconds) {
    if (isMissing(seconds)) {
        return '--:--';
    }
    const whole = Math.floor(seconds);
    const pad = n => String(n).padStart(2, '0');
    const h = Math.floor(whole / SECONDS_PER_HOUR);
    const m = Math.floor((whole % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const s = whole % SECONDS_PER_MINUTE;
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatStatus(state) {
    const icon = state.playing ? '▶' : '⏸';
    const who = [state.title, state.artist].filter(Boolean).join(' — ');
    return `${icon} ${formatTime(state.position)} / ${formatTime(state.duration)}  ${who}  (${state.app || '?'})`;
}
