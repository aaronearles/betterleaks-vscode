const vscode = require('vscode');
const { runScan, getStatusBarItem } = require('./scanner');
const { clearDiagnostics, diagnosticCollection } = require('./diagnostics');
const { showSummary } = require('./summary');
const { BetterleaksCodeActionProvider } = require('./codeactions');

function activate(context) {
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(getStatusBarItem());

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file' },
            new BetterleaksCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('betterleaks.scanWorkspace', () => {
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspacePath) return;

            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Betterleaks: Scanning workspace...',
                    cancellable: false
                },
                () => new Promise((resolve) => {
                    runScan(workspacePath, resolve);
                })
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('betterleaks.showSummary', () => {
            showSummary();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            runScan(document.uri.fsPath);
        })
    );

    // Full workspace scan on activation to catch pre-existing secrets
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) runScan(workspacePath);
}

function deactivate() {
    clearDiagnostics();
}

module.exports = { activate, deactivate };
