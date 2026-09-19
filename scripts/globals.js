// The sources are concatenated, so every top-level name is a global of every other file, and Biome
// lints one file at a time. This writes into biome.json what it cannot see: the names a file takes
// from another, and the names it declares for others. `make globals`; `--check` only compares.
const fs = require('node:fs');

const PLATFORM = ['$', 'ObjC', 'Application', 'Path', 'delay'];
const ENTRY_POINTS = ['run'];
const DECLARATION = /^(?:async\s+)?(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const KIND = { const: 'variable', let: 'variable', function: 'function', class: 'class' };

const makefile = fs.readFileSync('Makefile', 'utf8');
const listed = name => new RegExp(`^${name} := (.*)$`, 'm').exec(makefile)[1].split(' ').filter(file => file.endsWith('.js'));
const pure = listed('PURE');
const groups = [pure, listed('SOURCES')];
const files = [...pure, ...groups[1]].map(file => {
    const text = fs.readFileSync(file, 'utf8');
    return { file, text, declared: [...text.matchAll(DECLARATION)].map(match => ({ kind: KIND[match[1]], name: match[2] })) };
});
const mentions = (text, name) => new RegExp(`(?<![\\w$.])${name.replace('$', '\\$')}(?![\\w$])`, 'g').exec(text) !== null;
const tests = fs
    .readdirSync('test')
    .map(file => fs.readFileSync(`test/${file}`, 'utf8'))
    .join('\n');

function listsFor(group, platform) {
    const members = files.filter(each => group.includes(each.file));
    const taken = [];
    const given = { function: [], variable: [], class: [] };
    for (const owner of files) {
        for (const { kind, name } of owner.declared) {
            const elsewhere = files.some(other => other !== owner && mentions(other.text, name));
            if (members.some(member => member !== owner && mentions(member.text, name)) && !taken.includes(name)) {
                taken.push(name);
            }
            const forOthers = elsewhere || mentions(tests, name) || ENTRY_POINTS.includes(name);
            if (members.includes(owner) && forOthers) {
                given[kind].push(name);
            }
        }
    }
    return { globals: [...platform, ...taken], ignore: Object.fromEntries(Object.entries(given).filter(([, names]) => names.length > 0)) };
}

const biome = JSON.parse(fs.readFileSync('biome.json', 'utf8'));
const before = JSON.stringify(biome);
groups.forEach((group, index) => {
    const override = biome.overrides.find(each => each.includes.includes(group[group.length - 1]) && each.javascript);
    const { globals, ignore } = listsFor(group, index === 0 ? [] : PLATFORM);
    override.includes = group;
    override.javascript.globals = globals;
    override.linter.rules.correctness.noUnusedVariables.options.ignore = ignore;
});
if (process.argv.includes('--check')) {
    if (JSON.stringify(biome) !== before) {
        console.error('biome.json is behind the sources: make globals');
        process.exit(1);
    }
} else {
    fs.writeFileSync('biome.json', `${JSON.stringify(biome, null, 4)}\n`);
}
