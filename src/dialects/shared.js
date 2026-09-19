const appName = state => (state.app || 'player').split('.').pop();

function refuse(tool, what) {
    print(`nowplayingseek speaks ${tool} to the one player macOS elected: ${what} is out of its reach`, true);
    $.exit(1);
}

function unknown(tool, words) {
    print(`nowplayingseek does not know "${words.join(' ')}" in the dialect of ${tool}`, true);
    $.exit(EXIT.usage);
}

function move(place) {
    if (Object.hasOwn(place, 'to')) {
        return player.seekTo(place.to);
    }
    player.seekBy(place.by, {});
}
