// Replays recorded turns of a real keyboard knob (test/knob/*.json) through the knob logic of
// src/core/logic and checks that each one feels the way it was turned. `make knob-replay`.
//
//   node scripts/knob-replay.js "<pure files>" [--set knob.fast=30]... [--refresh 0.6] [--try draft.js] [--plain]
//
// The player is a model: it plays at rate 1 and Now Playing reports a seek --refresh seconds after
// it (IINA 0.05-0.15, VLC about 0.6, see docs/how-it-works.md). Each click is one run of
// `forward|backward --knob` at the moment the knob sent it; startup time is left out.
// --try loads a file over src/core/logic, so a draft knobRate or knobMultiplier is judged before it
// replaces the real one. --plain is a knob bound to `forward 5` without --knob: every click one step.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const load = file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: path.resolve(file) });
const args = process.argv.slice(2);
args.shift().split(' ').filter(Boolean).forEach(load);

const overrides = [];
let refresh = 0.15;
let plain = false;
while (args.length > 0) {
    const flag = args.shift();
    if (flag === '--set') {
        overrides.push(args.shift());
    } else if (flag === '--refresh') {
        refresh = Number(args.shift());
    } else if (flag === '--plain') {
        plain = true;
    } else if (flag === '--try') {
        load(args.shift());
    } else {
        throw new Error(`unknown argument ${flag}`);
    }
}

const ini = [];
for (const pair of overrides) {
    const [key, value] = pair.split('=');
    const [section, name] = key.split('.');
    ini.push(`[${section}]`, `${name} = ${value}`);
}
const settings = resolveSettings(parseIni(ini.join('\n'))).values;

const FEELINGS = {
    careful: {
        promise: 'moves 20 s at most',
        holds: ({ moved }) => Math.abs(moved) <= 20,
    },
    far: {
        promise: 'moves 2 minutes or more',
        holds: ({ moved }) => Math.abs(moved) >= 120,
    },
    slowing: {
        promise: 'moves 90 s or more, the last three clicks 1.3 steps at most',
        holds: ({ moved, steps }) => Math.abs(moved) >= 90 && Math.max(...steps.slice(-3)) <= 1.3,
    },
    searching: {
        promise: 'no click moves more than 1.5 steps',
        holds: ({ steps }) => Math.max(...steps) <= 1.5,
    },
};

function clicksOf(scenario) {
    const turns = scenario.turns || [scenario];
    return turns.flatMap(turn =>
        turn.clicks_ms.map(ms => ({ at: ((turn.start_ms || 0) + ms) / 1000, sign: turn.direction === 'forward' ? 1 : -1 })),
    );
}

function replay(clicks) {
    const duration = 3600;
    const startAt = 600;
    let seek = { target: startAt, at: 0 };
    let lastSeek = null;
    const steps = [];
    const positionAt = t => seek.target + (t - seek.at);
    for (const { at: now, sign } of clicks) {
        const refreshed = now - seek.at >= refresh;
        const state = {
            app: 'player',
            position: refreshed ? positionAt(now) : positionAt(seek.at - refresh),
            timestamp: refreshed ? seek.at + refresh : seek.at - refresh,
            rate: 1,
            duration,
        };
        const base = seekBase(state, lastSeek, now, settings.timing.pending_seek_max);
        const rate = knobRate(lastSeek, sign, now, settings.progressive.streak_gap);
        const multiplier = plain ? 1 : knobMultiplier(rate, settings.knob);
        const target = nextHoldTarget(base, sign * settings.knob.step, multiplier, duration);
        if (isMissing(target)) {
            continue;
        }
        steps.push(multiplier);
        seek = { target, at: now };
        lastSeek = { target, at: now, app: 'player', direction: sign, streakStart: now, rate };
    }
    const end = clicks.at(-1).at;
    return { steps, moved: positionAt(end) - startAt - end };
}

let failed = 0;
const dir = 'test/knob';
console.log(`knob: step ${settings.knob.step} s, fast ${settings.knob.fast}/s, max x${settings.knob.max_multiplier}; Now Playing refresh ${refresh} s\n`);
for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const scenario = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const feeling = FEELINGS[scenario.feeling];
    const clicks = clicksOf(scenario);
    const result = replay(clicks);
    const ok = feeling.holds(result);
    failed += ok ? 0 : 1;
    const moved = `${result.moved >= 0 ? '+' : ''}${result.moved.toFixed(0)} s`;
    const synthetic = scenario.source.startsWith('SYNTHETIC') ? '  (synthetic)' : '';
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${file.padEnd(26)} ${String(clicks.length).padStart(2)} clicks in ${clicks.at(-1).at.toFixed(2)} s -> ${moved} of video${synthetic}`);
    console.log(`     steps  ${result.steps.map(each => each.toFixed(1)).join(' ')}`);
    console.log(`     wanted ${scenario.feeling}: ${feeling.promise}\n`);
}
console.log(failed === 0 ? 'every turn feels as it was meant' : `${failed} turns do not feel as they were meant`);
process.exit(failed === 0 ? 0 : 1);
