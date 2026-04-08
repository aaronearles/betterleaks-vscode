# Design Decisions

Decisions made during development, with rationale. Reference this when writing the README.

## 1. `execFile()` over `exec()`

**Decision:** Use `child_process.execFile()` with an args array instead of `exec()` with string interpolation.

**Why:** The Clutch extension uses `exec()` and constructs the command as a single string. This breaks silently on paths containing spaces (e.g., `C:\Users\...\OneDrive - CompanyName\...`) because the shell splits on whitespace. PR #6 on their repo is still unmerged. `execFile()` bypasses the shell entirely — arguments are passed directly to the process, so spaces, special characters, and shell metacharacters are never an issue.

## 2. JSON report output instead of verbose text parsing

**Decision:** Use `--report-format json --report-path <tempfile>` instead of parsing betterleaks' human-readable verbose output with regex.

**Why:** The Clutch extension parses verbose text output by splitting on double newlines and regex-extracting fields. This is fragile — any change to the output format (extra fields, reordering, multi-line values) breaks parsing. JSON output is structured, versioned, and reliable. We write to a temp file, read it after the scan, and clean up.

## 3. Per-file scan on save, full workspace scan on activate

**Decision:** `onDidSaveTextDocument` scans only the saved file. A full workspace scan runs once on extension activation and is available as an explicit command.

**Why:** The Clutch extension scans the entire workspace on every save (issue #5 on their repo). With autosave enabled, this means continuous full-workspace scans. Per-file scans are fast and sufficient for the on-save case. The activation scan catches pre-existing secrets when opening a workspace. The explicit "Scan Workspace" command is there for manual full sweeps.

## 4. Diagnostics merging for per-file scans

**Decision:** Per-file scans update only that file's diagnostics (`setFileFindings`), preserving findings from other files. Workspace scans replace everything (`setFindings`).

**Why:** If a per-file scan cleared all diagnostics first, you'd lose findings from every other file in the workspace. The status bar count reads the total across the entire `DiagnosticCollection` so it stays accurate regardless of scan mode.

## 5. `--exit-code 0` flag

**Decision:** Pass `--exit-code 0` to betterleaks so it always exits 0 on a successful scan, whether or not findings exist.

**Why:** Like gitleaks, betterleaks exits with code 1 when it finds secrets. In `execFile()`, a non-zero exit code produces an `err` object in the callback. Without `--exit-code 0`, we'd have to distinguish "findings found" (exit 1, not an error) from actual failures — easy to get wrong and exactly the kind of ambiguity the Clutch extension handles incorrectly.

## 6. Scan queuing

**Decision:** If a scan is already in progress, queue the next request and run it after the current one finishes (only the most recent request is kept).

**Why:** Rapid saves (especially with autosave) could otherwise spawn overlapping betterleaks processes. Queuing with coalescing means at most one scan runs at a time, and we don't waste work on stale intermediate saves.

## 7. HTML escaping in summary webview

**Decision:** All user-derived values are escaped with `escapeHtml()` before rendering in the webview panel.

**Why:** The Clutch extension shipped with an XSS vulnerability (issue #2) — secret values containing HTML were rendered unescaped. Since the "secrets" being displayed are by definition attacker-controllable content, this is a real attack vector, not theoretical.

## 8. `maxBuffer` set to 10MB

**Decision:** Set `maxBuffer: 10 * 1024 * 1024` on `execFile()`.

**Why:** Node's default is 1MB. On large workspaces, stdout/stderr can exceed this, causing silent truncation. While we now use file-based JSON output for findings, stderr and any unexpected stdout still flow through the buffer.
