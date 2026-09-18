// A seek shows up in Now Playing 50–150 ms after the call, and over a second when a web
// page has to buffer (measured: Vivaldi + YouTube, macOS 26.6). Key repeat is faster
// than that, so until Now Playing refreshes, a held hotkey must build on the previous
// target instead of the stale position. The cap stops a player that ignores seeks from
// accumulating targets forever.
const PENDING_SEEK_MAX_SECONDS = 3;
const VERIFY_TIMEOUT_SECONDS = 2.5;
const DEFAULT_STEP_SECONDS = 10;

const EXIT = { ok: 0, nothingPlaying: 1, ignored: 2, usage: 64 };

function Failure(code, message) {
    this.code = code;
    this.message = message;
}

// ElapsedTime is a snapshot taken at Timestamp, not the current position.
function livePosition(elapsed, rate, timestamp, now) {
    if (elapsed == null) return null;
    if (timestamp == null) return elapsed;
    return elapsed + (rate || 0) * (now - timestamp);
}

function clampTarget(target, duration) {
    const upper = duration > 0 ? duration : Infinity;
    return Math.max(0, Math.min(upper, target));
}

function seekBase(state, lastSeek, now) {
    const pending = lastSeek
        && now - lastSeek.at < PENDING_SEEK_MAX_SECONDS
        && (state.timestamp == null || state.timestamp < lastSeek.at);
    return pending ? lastSeek.target : state.position;
}

function seekLanded(after, target, calledAt, superseded) {
    if (!after || after.timestamp == null || after.timestamp < calledAt) return false;
    if (superseded) return true;
    const drift = after.position - target;
    return drift > -1 && drift < 1 + VERIFY_TIMEOUT_SECONDS * (after.rate || 1);
}

function expectedPlaying(command, wasPlaying) {
    if (command === 'toggle') return !wasPlaying;
    if (command === 'play') return true;
    if (command === 'pause') return false;
    return null;
}

function parseTime(text) {
    if (!/^\d+(\.\d+)?$|^\d+(:[0-5]?\d){1,2}$/.test(text)) return null;
    return text.split(':').reduce((total, part) => total * 60 + parseFloat(part), 0);
}

function formatTime(seconds) {
    if (seconds == null) return '--:--';
    const whole = Math.floor(seconds);
    const pad = n => String(n).padStart(2, '0');
    const h = Math.floor(whole / 3600), m = Math.floor(whole % 3600 / 60), s = whole % 60;
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatStatus(state) {
    const icon = state.playing ? '▶' : '⏸';
    const who = [state.title, state.artist].filter(Boolean).join(' — ');
    return `${icon} ${formatTime(state.position)} / ${formatTime(state.duration)}  ${who}  (${state.app || '?'})`;
}
