const LOCK_PATIENCE = 0.5;
const LOCK_POLL = 0.005;
const TEMPORARY = $.NSTemporaryDirectory().js;

const now = () => Date.now() / MILLISECONDS_PER_SECOND;

function jsonFile(name) {
    const path = `${TEMPORARY}nowplayingseek.${name}.json`;
    return {
        read() {
            const text = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
            try {
                return text.js ? JSON.parse(text.js) : null;
            } catch {
                return null;
            }
        },
        write(value) {
            $(JSON.stringify(value)).writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
        },
    };
}

const lastSeekFile = jsonFile('last-seek');
const holdFile = jsonFile('hold');
const releaseFiles = { 1: jsonFile('release-forward'), [-1]: jsonFile('release-backward') };

// Presses 30 ms apart are separate processes: without this, two of them read the same last seek and
// one press is lost. A lock left by a process that died is broken after LOCK_PATIENCE.
function locked(action) {
    const lock = $.NSDistributedLock.lockWithPath(`${TEMPORARY}nowplayingseek.lock`);
    const started = now();
    while (!lock.tryLock) {
        if (now() - started > LOCK_PATIENCE * 2) {
            return action();
        }
        if (now() - started > LOCK_PATIENCE) {
            // biome-ignore lint/suspicious/noUnusedExpressions: JXA calls a no-argument ObjC method by reading the property
            lock.breakLock;
        }
        delay(LOCK_POLL);
    }
    try {
        return action();
    } finally {
        // biome-ignore lint/suspicious/noUnusedExpressions: the same
        lock.unlock;
    }
}
