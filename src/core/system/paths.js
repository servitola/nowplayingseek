// Where this script itself lives: osascript is handed its path as the fourth argument, and the
// artwork bundle is installed next to it, whatever the prefix.
function scriptDirectory() {
    const argument = ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments)?.[3];
    if (!argument) {
        return null;
    }
    const script = $.NSURL.fileURLWithPath(argument).path.js;
    return $(script).stringByDeletingLastPathComponent.js;
}
