const STREAM_IDENTITY = ['processIdentifier', 'bundleIdentifier', 'parentApplicationBundleIdentifier', 'title', 'artist', 'album'];

function streamChange(previous, current, diffing) {
    if (JSON.stringify(previous) === JSON.stringify(current)) {
        return null;
    }
    if (!current) {
        return { diff: false, payload: {} };
    }
    const sameItem = diffing && previous && STREAM_IDENTITY.every(key => previous[key] === current[key]);
    if (!sameItem) {
        return { diff: false, payload: current };
    }
    const payload = {};
    for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
        if (previous[key] !== current[key]) {
            payload[key] = Object.hasOwn(current, key) ? current[key] : null;
        }
    }
    return { diff: true, payload };
}
