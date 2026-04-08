# Spec: betterleaks-vscode

A VS Code extension that wraps the betterleaks binary to scan workspaces for secrets on save, with a bundled IaC-focused ruleset requiring zero configuration from the user.

---

## Goals

- Detect secrets in Terraform, PowerShell, bash, and related IaC files as the engineer saves
- Work out of the box with no config file required in the repo
- Bundle a sensible default ruleset targeting IaC patterns beyond betterleaks' built-in defaults
- Allow per-repo override via `.betterleaks.toml` or `.gitleaks.toml` (betterleaks supports both natively)
- Support `# betterleaks:allow` and `# gitleaks:allow` inline suppression comments
- Zero external dependencies for the end user — no Node, no Python, no package managers
- Windows-first (team uses Windows/OneDrive paths), but support macOS and Linux correctly

---

## Non-Goals

- Git history scanning (this is an IDE tool, not a CI scanner)
- A settings UI panel (keep it simple for non-developer users)
- Telemetry or any outbound network calls of any kind

---

## Repository Structure

```
betterleaks-vscode/
├── src/
│   ├── extension.js       — activate/deactivate
│   ├── scanner.js         — binary execution and output parsing
│   ├── diagnostics.js     — VS Code diagnostic collection management
│   ├── config.js          — bundled ruleset as an exported string constant
│   └── summary.js         — webview panel for findings summary
├── executables/           — populated at package time, not committed
│   ├── betterleaks_1.1.2_windows_x64.exe
│   ├── betterleaks_1.1.2_windows_arm64.exe
│   ├── betterleaks_1.1.2_darwin_arm64
│   ├── betterleaks_1.1.2_darwin_x64
│   ├── betterleaks_1.1.2_linux_x64
│   └── betterleaks_1.1.2_linux_arm64
├── .vscode/
│   └── launch.json        — Extension Development Host config for F5 testing
├── .vscodeignore
├── package.json
├── README.md
└── LICENSE                — MIT
```

---

## package.json

```json
{
  "name": "betterleaks-vscode",
  "displayName": "Betterleaks Secrets Scanner",
  "description": "Scans your workspace for secrets using betterleaks, with built-in rules for Terraform, PowerShell, and IaC files.",
  "version": "0.1.0",
  "publisher": "YOUR_PUBLISHER_ID",
  "icon": "icon.png",
  "license": "MIT",
  "repository": "https://github.com/YOUR_GITHUB/betterleaks-vscode",
  "engines": { "vscode": "^1.74.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./src/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "betterleaks.scanWorkspace",
        "title": "Betterleaks: Scan Workspace for Secrets"
      },
      {
        "command": "betterleaks.showSummary",
        "title": "Betterleaks: Show Findings Summary"
      }
    ]
  }
}
```

---

## src/extension.js

Entry point. Registers commands and the `onDidSaveTextDocument` event hook.

```javascript
const vscode = require('vscode');
const { runScan } = require('./scanner');
const { clearDiagnostics, diagnosticCollection } = require('./diagnostics');

function activate(context) {
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        vscode.commands.registerCommand('betterleaks.scanWorkspace', () => {
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspacePath) runScan(workspacePath);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspacePath) runScan(workspacePath);
        })
    );
}

function deactivate() {
    clearDiagnostics();
}

module.exports = { activate, deactivate };
```

---

## src/scanner.js

Core logic. Resolves the correct binary for the current platform/arch, passes the bundled ruleset via `BETTERLEAKS_CONFIG_TOML` environment variable, runs the scan, and hands results to diagnostics.

### Binary resolution

Use `process.platform` and `process.arch` to construct the binary filename, e.g.:
- `betterleaks_1.1.2_windows_x64.exe`
- `betterleaks_1.1.2_darwin_arm64`
- `betterleaks_1.1.2_linux_x64`

Look for the binary in `executables/` relative to `__dirname`. Throw a clear error if not found.

### Command execution

Use `execFile()` — NOT `exec()`. This passes arguments as an array directly to the process, bypassing shell interpretation entirely. This correctly handles workspace paths containing spaces (e.g. OneDrive-synced folders like `C:\Users\...\OneDrive - CompanyName\...`) without any quoting required.

```javascript
const { execFile } = require('child_process');

const args = [
    'dir',
    workspacePath,
    '--no-banner',
    '--no-color',
    '-v',
    '--log-level', 'error'
];

const env = {
    ...process.env,
    BETTERLEAKS_CONFIG_TOML: BUNDLED_CONFIG  // imported from config.js
};

execFile(binaryPath, args, { env }, (err, stdout, stderr) => { ... });
```

**Important:** `BETTERLEAKS_CONFIG_TOML` is only used as a fallback if no `.betterleaks.toml` or `.gitleaks.toml` exists in the workspace root. This is betterleaks' native config precedence behavior — the extension does not need to implement this logic itself.

### Output parsing

Betterleaks verbose output format (same as gitleaks):
```
Finding:     <matched line>
Secret:      <extracted secret>
RuleID:      <rule-id>
Entropy:     <float>
File:        <absolute path>
Line:        <int>
Fingerprint: <fingerprint>
```

Parse by splitting on double newlines and extracting fields with regex per block. Build a map of `filePath -> vscode.Diagnostic[]` and pass to diagnostics.js.

### Error handling

- `stderr` non-empty AND stdout empty → show `vscode.window.showErrorMessage()`
- `stdout` empty AND `stderr` empty → show `vscode.window.showInformationMessage('No secrets found in <path>')`
- `stdout` non-empty → parse findings, update diagnostics, update status bar

---

## src/diagnostics.js

Manages the `vscode.DiagnosticCollection`. Exposes:
- `diagnosticCollection` — the singleton collection
- `setFindings(fileMap)` — clears and repopulates from a `Map<string, vscode.Diagnostic[]>`
- `clearDiagnostics()` — clears and disposes on deactivate

Diagnostic severity: `vscode.DiagnosticSeverity.Error`
Diagnostic message format: `Potential <ruleID> detected: <secret>`
Range: full line (column 0 to 150000000) — gitleaks/betterleaks verbose output does not include column position.

---

## src/config.js

Exports the bundled ruleset as a string constant `BUNDLED_CONFIG`.

```javascript
const BUNDLED_CONFIG = `
title = "Betterleaks IaC Ruleset"

[extend]
useDefault = true

# --- Terraform / IaC Rules ---

[[rules]]
id = "iac-generic-password"
description = "Generic password assignment in IaC files"
regex = '''(?i)(password|passwd|pwd|secret|token|key)\\s*=\\s*["']([^"']{8,})["']'''
secretGroup = 2
entropy = 3.0
tokenEfficiency = true
keywords = ["password", "passwd", "pwd", "secret", "token", "key"]
path = '''\\.(tf|tfvars|auto\\.tfvars|env|ps1|psm1|psd1|sh|bash)$'''

  [[rules.allowlists]]
  description = "Allow placeholder values"
  regexes = [
    '''(?i)(placeholder|changeme|fake|example|dummy|todo|tbd|<[^>]+>|\\$\\{)'''
  ]

[[rules]]
id = "iac-connection-string"
description = "Database or storage connection string"
regex = '''(?i)(connection[_-]?string|connstr|jdbc)\\s*=\\s*["']([^"']{12,})["']'''
secretGroup = 2
entropy = 3.5
tokenEfficiency = true
keywords = ["connection", "connstr", "jdbc"]

[[rules]]
id = "iac-azure-storage-key"
description = "Azure storage account key pattern"
regex = '''(?i)(account[_-]?key|storage[_-]?key|access[_-]?key)\\s*=\\s*["']([A-Za-z0-9+/]{60,}={0,2})["']'''
secretGroup = 2
entropy = 4.5
keywords = ["account_key", "storage_key", "access_key"]

[[rules]]
id = "iac-sas-token"
description = "Azure SAS token"
regex = '''(?i)sas[_-]?token\\s*=\\s*["'](sv=.{20,})["']'''
secretGroup = 1
keywords = ["sas_token", "sas"]

# --- Global Allowlist ---

[[allowlists]]
description = "Ignore common non-secret file types"
paths = [
  '''\\.(png|jpg|gif|svg|ico|woff|ttf|eot|pdf|lock)$''',
  '''\\.terraform[\\\\/]''',
  '''terraform\\.tfstate'''
]
`;

module.exports = { BUNDLED_CONFIG };
```

> **Note:** These are starter rules. Tune entropy thresholds and add rules based on real-world testing against your team's Terraform codebase before publishing. The `tokenEfficiency = true` flag on generic rules is the key differentiator from the gitleaks-based Clutch extension.

---

## src/summary.js

Webview panel showing a table of current findings. Columns: File, Line, RuleID, Secret.

Triggered by `betterleaks.showSummary` command. Refreshes when the panel gains focus. Uses `escapeHtml()` on all user-derived values before rendering.

---

## Status Bar

Display a status bar item (right-aligned) showing the current finding count:
- `$(shield) No secrets found` — when clean
- `$(warning) 3 secrets detected` — when findings exist, clicking opens the summary panel

---

## .vscode/launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
    }
  ]
}
```

Do not commit this file — add `.vscode/` to `.gitignore`.

---

## package.json scripts — binary download at package time

The `vscode:prepublish` script should download all betterleaks release binaries into `executables/`, extract them, rename them to include platform/arch in the filename, and clean up archives.

**Current version: `1.1.2`**

Base URL:
```
https://github.com/betterleaks/betterleaks/releases/download/v1.1.2/
```

Assets to download and their extracted binary names:

| Asset | Format | Extracted binary |
|---|---|---|
| `betterleaks_1.1.2_windows_x64.zip` | zip | `betterleaks_1.1.2_windows_x64.exe` |
| `betterleaks_1.1.2_windows_arm64.zip` | zip | `betterleaks_1.1.2_windows_arm64.exe` |
| `betterleaks_1.1.2_darwin_arm64.tar.gz` | tar.gz | `betterleaks_1.1.2_darwin_arm64` |
| `betterleaks_1.1.2_darwin_x64.tar.gz` | tar.gz | `betterleaks_1.1.2_darwin_x64` |
| `betterleaks_1.1.2_linux_x64.tar.gz` | tar.gz | `betterleaks_1.1.2_linux_x64` |
| `betterleaks_1.1.2_linux_arm64.tar.gz` | tar.gz | `betterleaks_1.1.2_linux_arm64` |

After extraction, each archive contains a single binary named `betterleaks` (or `betterleaks.exe` on Windows). Rename it to include the platform/arch suffix before cleaning up the archive, so all six binaries coexist in `executables/`.

The `executables/` directory should be in `.gitignore` but NOT in `.vscodeignore` (it must be included in the packaged `.vsix`).

---

## .vscodeignore

```
.vscode/**
.git/**
src/**/*.test.js
node_modules/**
**/*.map
```

Do NOT ignore `executables/` — binaries must be included in the packaged extension.

---

## Testing checklist before publishing

1. **F5 test on path without spaces** — open `C:\temp\gitleaks-test`, save `secrets.auto.tfvars`, confirm finding appears
2. **F5 test on path with spaces** — open a workspace under `OneDrive - CompanyName`, save file with secret, confirm finding appears (this is the bug the Clutch extension has)
3. **Inline suppression** — add `# betterleaks:allow` to a flagged line, confirm it clears
4. **Per-repo override** — add a `.betterleaks.toml` to the workspace root, confirm it takes precedence over bundled config
5. **Clean file** — confirm "No secrets found" message on a file with no secrets
6. **Status bar** — confirm count updates correctly on each save

---

## Publishing

```powershell
npm install -g @vscode/vsce
vsce package   # produces betterleaks-vscode-0.1.0.vsix
vsce publish   # requires PAT from marketplace.visualstudio.com/manage
```

Create publisher at: https://marketplace.visualstudio.com/manage