// The sources are concatenated, so every top-level name is a global of every other file, and Biome
// lints one file at a time. This writes into biome.json what it cannot see: the names a file takes
// from another, and the names it declares for others. `make globals`; `--check` only compares.
//
// It also enforces the core/feature boundary: a feature is a file a core file never calls
// (AGENTS.md). CORE and FEATURES are read with `make print-<VAR>` rather than by re-parsing the
// Makefile text, since SOURCES is itself built from other variables now.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const PLATFORM = ['$', 'ObjC', 'Application', 'Path', 'delay'];
const ENTRY_POINTS = ['run'];
const DECLARATION = /^(?:async\s+)?(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const KIND = { const: 'variable', let: 'variable', function: 'function', class: 'class' };

const listed = name => execFileSync('make', [`print-${name}`], { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean);
const pure = listed('PURE');
const sourcesAll = listed('SOURCES');
const rest = sourcesAll.filter(file => !pure.includes(file));
const groups = [pure, rest];
const core = listed('CORE');
const features = listed('FEATURES');

const files = [...pure, ...rest].map(file => {
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

// Strips string/template literals and comments so a word inside one (an error message, a help
// line, an explanatory comment) is never mistaken for a reference to a same-named symbol.
const STRING_OR_COMMENT = /`(?:\\.|\$\{[^{}]*\}|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*|\/\*[\s\S]*?\*\//g;
const codeOnly = text => text.replace(STRING_OR_COMMENT, match => ' '.repeat(match.length));

// A name that this file itself binds — a parameter, a destructured parameter, an object method's
// own name, a local const/let — shadows any same-named global for the rest of the file; a mention
// of it here says nothing about a cross-file reference, so the boundary check leaves it alone.
function locallyBound(text) {
    const names = new Set();
    for (const [, params] of text.matchAll(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*(?:\{|=>)/g)) {
        for (const [token] of params.matchAll(/[A-Za-z_$][\w$]*/g)) {
            names.add(token);
        }
    }
    for (const [, name] of text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g)) {
        names.add(name);
    }
    for (const [, name] of text.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
        names.add(name);
    }
    return names;
}

// A symbol declared only under FEATURES is off limits to a CORE file — the boundary a folder name
// alone cannot enforce, and the one this whole pass exists to check for the reader.
function boundaryViolations() {
    const declaredIn = list => new Set(files.filter(each => list.includes(each.file)).flatMap(each => each.declared.map(d => d.name)));
    const featureOnly = [...declaredIn(features)].filter(name => !declaredIn(core).has(name));
    const violations = [];
    for (const owner of files.filter(each => core.includes(each.file))) {
        const code = codeOnly(owner.text);
        const shadowed = locallyBound(code);
        for (const name of featureOnly) {
            if (!shadowed.has(name) && !mentions(code, `${name}:`) && mentions(code, name)) {
                violations.push(`${owner.file} mentions "${name}", declared only under features/`);
            }
        }
    }
    return violations;
}

const violations = boundaryViolations();
if (violations.length > 0) {
    console.error(violations.join('\n'));
    console.error('a core file may not depend on a feature — see AGENTS.md\'s core/feature rule');
    process.exit(1);
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
