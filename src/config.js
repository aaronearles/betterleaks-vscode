const fs = require('fs');
const path = require('path');

const RULESET_PATH = path.join(__dirname, '..', 'betterleaks-ruleset.toml');

function getBundledConfig() {
    return fs.readFileSync(RULESET_PATH, 'utf8');
}

function hasWorkspaceConfig(workspacePath) {
    return (
        fs.existsSync(path.join(workspacePath, '.betterleaks.toml')) ||
        fs.existsSync(path.join(workspacePath, '.gitleaks.toml'))
    );
}

module.exports = { getBundledConfig, hasWorkspaceConfig };
