COMMANDS.config = (args, _name, output) => {
    const [action, name, value, ...extra] = args;
    const setting = action === 'set' && extra.length === 0 ? `${name} = ${value} to ${configFile.set(name, value)}` : null;
    if (output.shape !== 'line') {
        return showJson({ path: configFile.path(), found: configFile.exists(), settings: configFile.load().values }, output, null);
    }
    if (setting || (args.length === 1 && args[0] === 'init')) {
        return print(`wrote ${setting || configFile.init()}`);
    }
    if (args.length > 0) {
        throw new Failure(EXIT.usage, `config takes "init", "set <setting> <value>" or nothing, got "${args.join(' ')}"`);
    }
    const found = configFile.exists() ? '' : ' — not found, these are the defaults';
    const listing = `; ${configFile.path()}${found}\n\n${formatSettings(configFile.load().texts)}`;
    print(terminal.colours() ? paintIni(listing) : listing);
};
