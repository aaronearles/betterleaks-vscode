const vscode = require('vscode');

const LINE_COMMENT_PREFIX = {
    // IaC / config
    terraform: '#',
    hcl: '#',
    yaml: '#',
    toml: '#',
    ini: '#',
    properties: '#',
    dockerfile: '#',
    // Shell
    shellscript: '#',
    bash: '#',
    zsh: '#',
    python: '#',
    ruby: '#',
    perl: '#',
    powershell: '#',
    // C-style
    javascript: '//',
    typescript: '//',
    json: '//',
    jsonc: '//',
    go: '//',
    java: '//',
    csharp: '//',
    cpp: '//',
    c: '//',
    rust: '//',
    swift: '//',
    kotlin: '//',
    // Other
    sql: '--',
    lua: '--',
    xml: '',
    html: '',
};

function getCommentPrefix(languageId) {
    if (languageId in LINE_COMMENT_PREFIX) {
        return LINE_COMMENT_PREFIX[languageId];
    }
    return '#';
}

class BetterleaksCodeActionProvider {
    provideCodeActions(document, range, context) {
        const actions = [];
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'betterleaks') continue;

            const line = document.lineAt(diagnostic.range.start.line);
            const prefix = getCommentPrefix(document.languageId);

            // Skip languages without line comments (XML, HTML)
            if (!prefix) continue;

            const action = new vscode.CodeAction(
                'Suppress this betterleaks finding',
                vscode.CodeActionKind.QuickFix
            );

            const edit = new vscode.WorkspaceEdit();
            const lineEnd = line.range.end;
            edit.insert(document.uri, lineEnd, `  ${prefix} gitleaks:allow`);
            action.edit = edit;
            action.diagnostics = [diagnostic];
            action.isPreferred = true;

            actions.push(action);
        }
        return actions;
    }
}

module.exports = { BetterleaksCodeActionProvider };
