const BAR_CELLS = 16;
const ESCAPE_CODE = 27;
const ESCAPE = String.fromCharCode(ESCAPE_CODE);
const INK = { bold: 1, dim: 2, accent: 36 };

const ink = (style, text) => `${ESCAPE}[${INK[style]}m${text}${ESCAPE}[0m`;

function paintedBar(position, duration) {
    const filled = Math.max(0, Math.min(BAR_CELLS, Math.round((position / duration) * BAR_CELLS)));
    return ink('accent', '━'.repeat(filled)) + ink('dim', '─'.repeat(BAR_CELLS - filled));
}

// For a terminal only. A pipe gets formatStatus, the line scripts already parse.
function paintStatus(state, { app, multiplier }) {
    const timed = state.duration > 0;
    const length = timed ? ink('dim', ` / ${formatTime(state.duration)}`) : '';
    const who = [state.title, state.artist].filter(Boolean);
    const parts = [
        `${ink('accent', state.playing ? '▶' : '⏸')} ${ink('bold', formatTime(state.position))}${length}`,
        timed ? paintedBar(state.position || 0, state.duration) : null,
        who.length > 0 ? [ink('bold', who[0]), ...who.slice(1)].join(' — ') : null,
        app ? ink('dim', `· ${app}`) : null,
        multiplier === 1 ? null : ink('accent', `×${multiplier}`),
    ];
    return parts.filter(Boolean).join('  ');
}
