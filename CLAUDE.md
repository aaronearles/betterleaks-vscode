# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VS Code extension wrapping the betterleaks binary to scan workspaces for secrets on save. Targets IaC files (Terraform, PowerShell, bash) with a bundled ruleset requiring zero user configuration. Windows-first (OneDrive paths with spaces), but supports macOS and Linux.

The full spec is in `betterleaks-vscode-spec.md`.

## Development

**Testing:** Press F5 in VS Code to launch the Extension Development Host (uses `.vscode/launch.json`). No test framework is configured — testing is manual via the Extension Development Host.

**Packaging:**
```
npm install -g @vscode/vsce
vsce package    # produces .vsix
vsce publish    # requires PAT from marketplace.visualstudio.com/manage
```

The `vscode:prepublish` script downloads betterleaks v1.1.2 binaries for all 6 platform/arch combos into `executables/`.

## Architecture

Plain JavaScript VS Code extension (no TypeScript, no bundler). Entry point: `src/extension.js`.

- **extension.js** — `activate()` registers the `scanWorkspace` command and `onDidSaveTextDocument` hook; both trigger a full workspace scan
- **scanner.js** — Resolves the correct platform/arch binary from `executables/`, runs it via `execFile()` (NOT `exec()`), passes the bundled ruleset through `BETTERLEAKS_CONFIG_TOML` env var, parses verbose output into findings
- **diagnostics.js** — Manages a singleton `DiagnosticCollection`; findings are `DiagnosticSeverity.Error` with full-line ranges
- **config.js** — Exports `BUNDLED_CONFIG` string constant (TOML ruleset). Only used as fallback when no `.betterleaks.toml` or `.gitleaks.toml` exists in workspace root (betterleaks handles this precedence natively)
- **summary.js** — Webview panel showing findings table; must `escapeHtml()` all user-derived values

## Key Design Decisions

- **`execFile()` over `exec()`** — Critical for handling workspace paths with spaces (OneDrive folders). Arguments passed as array, no shell interpretation.
- **No external dependencies** — No Node, Python, or package managers required by the end user. Binaries are bundled.
- **No git history scanning** — IDE tool only, not a CI scanner.
- **No network calls** — Zero telemetry, zero outbound traffic.
- **Inline suppression** — Supports `# betterleaks:allow` and `# gitleaks:allow` comments.

## File Conventions

- `executables/` is gitignored but NOT vscodeignored (binaries must ship in the .vsix)
- `.vscode/` is gitignored
- Betterleaks binary naming: `betterleaks_1.1.2_{platform}_{arch}[.exe]`
