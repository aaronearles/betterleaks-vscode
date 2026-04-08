# Betterleaks for VS Code

Scans your workspace for secrets using [betterleaks](https://github.com/betterleaks/betterleaks), with built-in rules for Terraform, PowerShell, and IaC files. Works out of the box with no configuration required.

## Features

- Scans files automatically on save and on workspace open
- Built-in ruleset targeting IaC patterns (passwords, connection strings, storage keys, SAS tokens)
- Findings appear in the Problems panel as errors with file, line, and rule details
- Status bar shows current finding count
- Summary panel with all findings in a table view
- Supports `# betterleaks:allow` and `# gitleaks:allow` inline suppression
- Per-repo override via `.betterleaks.toml` or `.gitleaks.toml` in workspace root
- Works on Windows paths with spaces (OneDrive folders)
- Zero external dependencies, zero network calls, zero telemetry

## Install

Download the `.vsix` from the [latest release](https://github.com/aaronearles/betterleaks-vscode/releases), then in VS Code:

**Extensions** > **...** > **Install from VSIX**

## Usage

The extension activates automatically. Secrets are detected:

- When you open a workspace (full scan)
- When you save a file (scans that file)
- When you run **Betterleaks: Scan Workspace for Secrets** from the command palette

Run **Betterleaks: Show Findings Summary** to see all findings in a table.

## Suppressing findings

Add a comment to the flagged line:

```hcl
password = "not-a-real-secret" # betterleaks:allow
```

## Custom rules

Drop a `.betterleaks.toml` or `.gitleaks.toml` in your workspace root. Betterleaks will use it instead of the bundled ruleset. See the [betterleaks config docs](https://github.com/betterleaks/betterleaks#configuration) for syntax.

## Supported platforms

Windows x64/arm64, macOS x64/arm64, Linux x64/arm64.

## Acknowledgments

Inspired by the [Clutch VS Code extension](https://github.com/clutchsecurity/clutch-vscode-extension) by Clutch Security. This extension bundles [betterleaks](https://github.com/betterleaks/betterleaks) by Zachary Rice, licensed under the MIT License. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for the full license text.

## License

MIT
