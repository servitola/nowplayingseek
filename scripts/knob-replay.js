// Replays recorded turns of a real keyboard knob (test/knob/*.json) through the knob logic of
// src/logic and checks that each one feels the way it was turned. `make knob-replay`.
//
//   node scripts/knob-replay.js "<pure files>" [--set knob.fast=30]... [--refresh 0.6]
//
// The player is a model: it plays at rate 1 and Now Playing reports a seek --refresh seconds after
// it (IINA 0.05-0.15, VLC about 0.6, see docs/how-it-works.md). Each click is one run of
// `forward|backward --knob` at the moment the knob sent it; startup time is left out.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const args = process.argv.slice(2);
const pure = args.shift().split(' ').filter(Boolean);
for (const file of pure) {
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: path.resolve(file) });
}

const overrides = [];
let refresh = 0.15;
while (args.length > 0) {
    const flag = args.shift();
    if (flag === '--set') {
        overrides.push(args.shift());
    } else if (flag === '--refresh') {
        refresh = Number(args.shift());
    } else {
        throw new Error(`unknown argument ${flag}`);
    }
}

// The friend who recorded these turns runs a 5 s knob step; everything else is the default.
const ini = ['[knob]', 'step = 5'];
for (const pair of overrides) {
    const [key, value] = pair.split('=');
    const [section, name] = key.split('.');
    ini.push(`[${section}]`, `${name} = ${value}`);
}
const settings = resolveSettings(parseIni(ini.join('\n'))).values;

const FEELINGS = {
    careful: {
        promise: 'no click moves more than 1.5 steps',
        holds: steps => Math.max(...steps) <= 1.5,
    },
    far: {
        promise: 'the clicks average at least 3 steps',
        holds: steps => average(steps) >= 3,
    },
    slowing: {
        promise: 'the first half averages 2.5 steps or more, the last three clicks 1.5 or less',
        holds: steps => average(steps.slice(0, steps.length / 2)) >= 2.5 && Math.max(...steps.slice(-3)) <= 1.5,
    },
};

const average = list => list.reduce((sum, each) => sum + each, 0) / list.length;

function replay({ direction, clicks_ms }) {
    const sign = direction === 'forward' ? 1 : -1;
    const duration = 3600;
    const startAt = 600;
    let seek = { target: startAt, at: 0 };
    let lastSeek = null;
    const steps = [];
    const positionAt = t => seek.target + (t - seek.at);
    for (const ms of clicks_ms) {
        const now = ms / 1000;
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
        const multiplier = knobMultiplier(rate, settings.knob);
        const target = nextHoldTarget(base, sign * settings.knob.step, multiplier, duration);
        if (isMissing(target)) {
            continue;
        }
        steps.push(multiplier);
        seek = { target, at: now };
        lastSeek = { target, at: now, app: 'player', direction: sign, streakStart: now, rate };
    }
    const end = clicks_ms.at(-1) / 1000;
    return { steps, moved: positionAt(end) - startAt - end };
}

let failed = 0;
const dir = 'test/knob';
console.log(`knob: step ${settings.knob.step} s, fast ${settings.knob.fast}/s, max x${settings.knob.max_multiplier}; Now Playing refresh ${refresh} s\n`);
for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const scenario = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const feeling = FEELINGS[scenario.feeling];
    const { steps, moved } = replay(scenario);
    const ok = feeling.holds(steps);
    failed += ok ? 0 : 1;
    const span = (scenario.clicks_ms.at(-1) / 1000).toFixed(2);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${file.padEnd(24)} ${String(steps.length).padStart(2)} clicks in ${span} s -> ${moved >= 0 ? '+' : ''}${moved.toFixed(0)} s of video`);
    console.log(`     steps  ${steps.map(each => each.toFixed(1)).join(' ')}`);
    console.log(`     wanted ${feeling.promise}\n`);
}
console.log(failed === 0 ? 'every turn feels as it was meant' : `${failed} turns do not feel as they were meant`);
process.exit(failed === 0 ? 0 : 1);
