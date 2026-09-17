function formatSettings(texts, keyPrefix = '') {
    return Object.entries(SETTINGS)
        .map(([section, specs]) => {
            const keys = Object.entries(specs).map(
                ([key, spec]) =>
                    `${spec.about
                        .split('\n')
                        .map(line => `; ${line}\n`)
                        .join('')}${keyPrefix}${key} = ${texts[section][key]}`
            );
            return `[${section}]\n${keys.join('\n\n')}`;
        })
        .join('\n\n');
}

// Every key commented: a file of live defaults would keep its owner on yesterday's numbers for ever.
function settingsTemplate() {
    const intro = '; Remove the "; " in front of a line to put it in force. What stays commented follows the defaults.';
    return `${intro}\n\n${formatSettings(resolveSettings([]).texts, '; ')}`;
}

const SETTING_NAME = /^([a-z_]+)\.([a-z_]+)$/;
const COMMENT_MARK = /^[;#]\s*/;

function settingAssignment(name = '', text = '') {
    const [, section, key] = SETTING_NAME.exec(name) || [];
    if (!(section && Object.hasOwn(SETTINGS, section) && Object.hasOwn(SETTINGS[section], key))) {
        throw new Failure(EXIT.usage, `config set needs a setting such as knob.fast, got "${name}"`);
    }
    const { expects } = SETTINGS[section][key];
    if (isMissing(parseSetting(text, expects))) {
        throw new Failure(EXIT.usage, `config set ${name} needs ${expects}, got "${text}"`);
    }
    return { section, key, text };
}

// The live line wins, as it does when the file is read; else the commented one `config init` wrote.
function findSetting(lines, section, key) {
    const found = { live: -1, commented: -1, last: -1 };
    let current = null;
    lines.forEach((raw, index) => {
        const line = raw.trim();
        const header = INI_SECTION.exec(line);
        if (header) {
            current = header[1].trim();
        }
        if (current !== section) {
            return;
        }
        found.last = line ? index : found.last;
        const bare = line.replace(COMMENT_MARK, '');
        const pair = header ? null : INI_PAIR.exec(bare);
        if (pair && pair[1].trim() === key) {
            found[bare === line ? 'live' : 'commented'] = index;
        }
    });
    return found;
}

function withSetting(text, { section, key, text: value }) {
    const lines = text.trim() ? text.trimEnd().split(LINE_BREAK) : [];
    const line = `${key} = ${value}`;
    const { live, commented, last } = findSetting(lines, section, key);
    if (live >= 0 || commented >= 0) {
        lines[live >= 0 ? live : commented] = line;
    } else if (last >= 0) {
        lines.splice(last + 1, 0, line);
    } else {
        lines.push(...(lines.length > 0 ? [''] : []), `[${section}]`, line);
    }
    return `${lines.join('\n')}\n`;
}
