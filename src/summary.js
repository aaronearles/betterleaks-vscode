const vscode = require('vscode');
const { diagnosticCollection } = require('./diagnostics');

let panel = null;

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showSummary() {
    if (panel) {
        panel.reveal();
    } else {
        panel = vscode.window.createWebviewPanel(
            'betterleaksSummary',
            'Betterleaks Findings',
            vscode.ViewColumn.One,
            { enableScripts: false }
        );
        panel.onDidDispose(() => { panel = null; });
        panel.onDidChangeViewState(() => {
            if (panel && panel.visible) {
                updatePanel();
            }
        });
    }

    updatePanel();
}

function updatePanel() {
    if (!panel) return;

    const rows = [];
    diagnosticCollection.forEach((uri, diagnostics) => {
        for (const d of diagnostics) {
            const filePath = uri.fsPath;
            const line = d.range.start.line + 1;
            const message = d.message;
            const ruleMatch = message.match(/^Potential (.+?) detected: (.+)$/);
            const ruleId = ruleMatch ? ruleMatch[1] : 'unknown';
            const secret = ruleMatch ? ruleMatch[2] : message;

            rows.push(`<tr>
                <td>${escapeHtml(filePath)}</td>
                <td>${line}</td>
                <td>${escapeHtml(ruleId)}</td>
                <td>${escapeHtml(secret)}</td>
            </tr>`);
        }
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 6px 12px; border-bottom: 1px solid var(--vscode-widget-border); }
        th { font-weight: bold; }
        tr:hover { background: var(--vscode-list-hoverBackground); }
        .empty { text-align: center; padding: 32px; color: var(--vscode-descriptionForeground); }
    </style>
</head>
<body>
    <h2>Betterleaks Findings</h2>
    ${rows.length === 0
        ? '<p class="empty">No secrets detected.</p>'
        : `<table>
            <thead><tr><th>File</th><th>Line</th><th>Rule</th><th>Secret</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
        </table>`
    }
</body>
</html>`;

    panel.webview.html = html;
}

module.exports = { showSummary };
