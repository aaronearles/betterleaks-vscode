const vscode = require('vscode');

const diagnosticCollection = vscode.languages.createDiagnosticCollection('betterleaks');

/**
 * Replace all diagnostics (used for full workspace scans).
 * @param {Map<string, vscode.Diagnostic[]>} fileMap
 */
function setFindings(fileMap) {
    diagnosticCollection.clear();
    for (const [filePath, diagnostics] of fileMap) {
        const uri = vscode.Uri.file(filePath);
        diagnosticCollection.set(uri, diagnostics);
    }
}

/**
 * Update diagnostics for a single file (used for on-save scans).
 * @param {string} filePath
 * @param {vscode.Diagnostic[]} diagnostics
 */
function setFileFindings(filePath, diagnostics) {
    const uri = vscode.Uri.file(filePath);
    diagnosticCollection.set(uri, diagnostics);
}

function getTotalCount() {
    let count = 0;
    diagnosticCollection.forEach((uri, diags) => { count += diags.length; });
    return count;
}

function clearDiagnostics() {
    diagnosticCollection.clear();
    diagnosticCollection.dispose();
}

module.exports = { diagnosticCollection, setFindings, setFileFindings, getTotalCount, clearDiagnostics };
