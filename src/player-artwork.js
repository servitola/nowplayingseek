function artworkKeys(raw) {
    return raw ? [raw.ArtworkIdentifier, raw.ArtworkMIMEType] : [undefined, undefined];
}

Object.assign(player, {
    artwork(wantedPath) {
        const state = player.requireState();
        const [identifier, mimeType] = artworkKeys(mediaRemote.raw(state));
        const fetched = artwork.fetch(identifier, mimeType, wantedPath);
        if (!fetched) {
            throw new Failure(EXIT.ignored, `${state.app || 'this app'} has no artwork for the item playing now`);
        }
        return fetched;
    },
});
