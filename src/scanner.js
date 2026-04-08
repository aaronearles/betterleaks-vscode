const vscode = require('vscode');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const { BUNDLED_CONFIG } = require('./config');
const { setFindings, setFileFindings, getTotalCount } = require('./diagnostics');

const BETTERLEAKS_VERSION = '1.1.2';

function getBinaryName() {
    const platformMap = { win32: 'windows', darwin: 'darwin', linux: 'linux' };
    const archMap = { x64: 'x64', arm64: 'arm64' };

    const platform = platformMap[process.platform];
    const arch = archMap[process.arch];

    if (!platform || !arch) {
        throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
    }

    const ext = process.platform === 'win32' ? '.exe' : '';
    return `betterleaks_${BETTERLEAKS_VERSION}_${platform}_${arch}${ext}`;
}

function getBinaryPath() {
    const binaryName = getBinaryName();
    return path.join(__dirname, '..', 'executables', binaryName);
}

let scanInProgress = false;
let pendingScan = null;

function runScan(targetPath) {
    if (scanInProgress) {
        pendingScan = targetPath;
        return;
    }

    scanInProgress = true;
    const isFileScan = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile();

    const reportPath = path.join(os.tmpdir(), `betterleaks-${process.pid}-${Date.now()}.json`);
    const binaryPath = getBinaryPath();
    const args = [
        'dir',
        targetPath,
        '--no-banner',
        '--log-level', 'error',
        '--report-format', 'json',
        '--report-path', reportPath,
        '--exit-code', '0'
    ];

    const env = {
        ...process.env,
        BETTERLEAKS_CONFIG_TOML: BUNDLED_CONFIG
    };

    execFile(binaryPath, args, { env, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        scanInProgress = false;

        if (pendingScan) {
            const nextPath = pendingScan;
            pendingScan = null;
            runScan(nextPath);
        }

        if (err) {
            vscode.window.showErrorMessage(`Betterleaks error: ${stderr ? stderr.trim() : err.message}`);
            cleanup(reportPath);
            return;
        }

        let findings;
        try {
            findings = readReport(reportPath);
        } catch (e) {
            vscode.window.showErrorMessage(`Betterleaks: failed to read report — ${e.message}`);
            return;
        } finally {
            cleanup(reportPath);
        }

        if (isFileScan) {
            const fileDiags = buildDiagnostics(findings);
            setFileFindings(targetPath, fileDiags);
        } else {
            const fileMap = buildFileMap(findings);
            setFindings(fileMap);
        }

        updateStatusBar(getTotalCount());
    });
}

function readReport(reportPath) {
    if (!fs.existsSync(reportPath)) {
        return [];
    }
    const raw = fs.readFileSync(reportPath, 'utf8');
    if (!raw.trim()) {
        return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
}

function cleanup(filePath) {
    try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
}

function makeDiagnostic(f) {
    const line = Math.max(0, (f.StartLine || f.Line || 1) - 1);
    const ruleId = f.RuleID || f.ruleID || 'unknown';
    const secret = f.Secret || f.secret || '(redacted)';

    const range = new vscode.Range(line, 0, line, 150000000);
    const diagnostic = new vscode.Diagnostic(
        range,
        `Potential ${ruleId} detected: ${secret}`,
        vscode.DiagnosticSeverity.Error
    );
    diagnostic.source = 'betterleaks';
    return diagnostic;
}

function buildDiagnostics(findings) {
    return findings.map(makeDiagnostic);
}

function buildFileMap(findings) {
    const fileMap = new Map();

    for (const f of findings) {
        const filePath = f.File || f.file;
        if (!filePath) continue;

        if (!fileMap.has(filePath)) {
            fileMap.set(filePath, []);
        }
        fileMap.get(filePath).push(makeDiagnostic(f));
    }

    return fileMap;
}

let statusBarItem;

function getStatusBarItem() {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
        statusBarItem.command = 'betterleaks.showSummary';
        statusBarItem.show();
    }
    return statusBarItem;
}

function updateStatusBar(count) {
    const item = getStatusBarItem();
    if (count === 0) {
        item.text = '$(shield) No secrets found';
        item.tooltip = 'Betterleaks: workspace is clean';
    } else {
        item.text = `$(warning) ${count} secret${count === 1 ? '' : 's'} detected`;
        item.tooltip = 'Betterleaks: click to view findings';
    }
}

module.exports = { runScan, getStatusBarItem };
