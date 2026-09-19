// Which lines of src/logic the unit tests never reach. The logic is plain JavaScript, so node can
// run it and V8 can count; osascript can do neither. `make coverage`.
const fs = require('node:fs');
const inspector = require('node:inspector');
const path = require('node:path');
const url = require('node:url');
const vm = require('node:vm');

const [pure, tests] = process.argv.slice(2).map(list => list.split(' ').filter(Boolean));
const load = file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: path.resolve(file) });

function uncoveredLines(file, functions) {
    const text = fs.readFileSync(file, 'utf8');
    const dead = new Array(text.length).fill(false);
    const ranges = functions.flatMap(each => each.ranges).sort((a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset));
    for (const range of ranges) {
        dead.fill(range.count === 0, range.startOffset, range.endOffset);
    }
    const lines = [];
    let offset = 0;
    text.split('\n').forEach((line, index) => {
        const code = line.trim() !== '' && !line.trim().startsWith('//');
        if (code && dead.slice(offset, offset + line.length).some(Boolean)) {
            lines.push(index + 1);
        }
        offset += line.length + 1;
    });
    return { lines, total: text.split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('//')).length };
}

const session = new inspector.Session();
session.connect();
session.post('Profiler.enable');
session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });

pure.forEach(load);
globalThis.GROUPS = [];
globalThis.count = 0;
globalThis.same = () => {
    globalThis.count += 1;
};
globalThis.failureOf = (_core, action) => {
    try {
        action();
    } catch (error) {
        return String(error);
    }
    return 'no failure';
};
tests.filter(file => !file.endsWith('harness.js')).forEach(load);
const exported = /;\(\{([^}]*)\}\)/.exec(fs.readFileSync('test/harness.js', 'utf8'))[1];
const core = vm.runInThisContext(`({${exported}})`);
for (const group of globalThis.GROUPS) {
    group(core);
}

session.post('Profiler.takePreciseCoverage', (_error, { result }) => {
    let reached = 0;
    let all = 0;
    for (const file of pure) {
        const script = result.find(each => each.url === url.pathToFileURL(file).href);
        if (!script) {
            throw new Error(`V8 has no record of ${file}`);
        }
        const { lines, total } = uncoveredLines(file, script.functions);
        reached += total - lines.length;
        all += total;
        const share = Math.round(((total - lines.length) / total) * 100);
        console.log(`${String(share).padStart(3)} %  ${file}${lines.length > 0 ? `  not reached: ${lines.join(' ')}` : ''}`);
    }
    console.log(`${Math.round((reached / all) * 100)} % of ${all} lines of logic are reached by the unit tests`);
});
