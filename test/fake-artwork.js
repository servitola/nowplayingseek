// Stands in for src/system/artwork.js: bytes come from a file next to the fake state, not perl.
// Caches by identifier like the real one, so a test can see that `stream` fetches once per item.
let fakeArtworkCache = null;

const artwork = {
    fetch(identifier, mimeType, wantedPath) {
        if (!identifier) {
            return null;
        }
        if (!wantedPath && fakeArtworkCache?.identifier === identifier) {
            return fakeArtworkCache;
        }
        const source = `${FAKE}/artwork-source`;
        if (!$.NSFileManager.defaultManager.fileExistsAtPath(source)) {
            return null;
        }
        const outPath = wantedPath || `${FAKE}/artwork-out.${(mimeType || '').split('/')[1] || 'jpg'}`;
        $.NSData.dataWithContentsOfFile(source).writeToFileAtomically(outPath, true);
        fakeLog(`artwork ${identifier}`);
        const fetched = { identifier, path: outPath, mimeType };
        if (!wantedPath) {
            fakeArtworkCache = fetched;
        }
        return fetched;
    },

    base64(identifier, mimeType) {
        const fetched = this.fetch(identifier, mimeType, null);
        if (!fetched) {
            return null;
        }
        const data = $.NSData.dataWithContentsOfFile(fetched.path);
        return data.js === undefined ? null : data.base64EncodedStringWithOptions(0).js;
    },
};
