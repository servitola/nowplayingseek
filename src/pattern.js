const PATTERN_POINT = /^(\d+(?:\.\d+)?)s?\s*:\s*x?(\d+(?:\.\d+)?)$/i;

function parsePattern(text) {
    if (text === 'smooth') {
        return { smooth: true };
    }
    const parts = text.split(',').map(part => part.trim());
    const continues = ['...', '…'].includes(parts.at(-1));
    if (continues) {
        parts.pop();
    }

    const points = [];
    for (const part of parts) {
        const match = PATTERN_POINT.exec(part);
        if (!match) {
            return null;
        }
        const point = { after: Number.parseFloat(match[1]), multiplier: Number.parseFloat(match[2]) };
        const previous = points.at(-1);
        if (point.multiplier <= 0 || (previous && point.after <= previous.after)) {
            return null;
        }
        points.push(point);
    }
    if (points.length === 0) {
        return null;
    }
    if (!continues) {
        return { points, pace: null };
    }

    const last = points.at(-1);
    const previous = points.at(-2) || { after: 0, multiplier: 1 };
    const pace = { every: last.after - previous.after, adds: last.multiplier - previous.multiplier };
    return pace.every > 0 && pace.adds >= 0 ? { points, pace } : null;
}
