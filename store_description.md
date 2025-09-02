# MRU Tab Stack — Store Listing Copy

## Short blurb (for search / manifest)
MRU Tab Stack — Lightweight tab manager that auto-moves your most recently used tab to the front or back; supports pinned tabs, tab groups, and keyboard shortcuts.

## Full store description
MRU Tab Stack helps you stay focused by keeping your most recently used tab within easy reach. When you switch to a tab, MRU Tab Stack can automatically move it to the front (or back) of the tab strip so you spend less time hunting for it. It respects pinned tabs and Chrome tab groups, and works with the keyboard shortcut (Ctrl+Space by default).

### Features
- Auto-move the most recently used tab to the front or end of the tab strip
- Works with pinned tabs and Chrome tab groups
- Customizable delay and ordering in Options
- Keyboard shortcut support (default: Ctrl+Space)
- Lightweight and privacy-first — no external servers

### How it works
Install, open Options to set the move delay and right-to-left behavior, then switch tabs as usual. The extension will move the active tab after the configured delay.

### Privacy
No browsing data is uploaded. Debug logs (optional) record only limited, non-sensitive tab summaries (hostnames only) and are stored locally in the extension console when enabled.

### Support & source
For support, issues, or to view the source, visit the project on GitHub (link in the options/about page).

## Suggested keywords / tags
tab manager, MRU, most recent tab, tab ordering, productivity, keyboard shortcut, Ctrl+Tab, pinned tabs, tab groups, focus

## Recommended assets for the store listing
- Screenshots (1–3) showing before/after behavior — recommended size: 1280×800 or similar
- Promotional image (440×280)
- Extension icon (128×128)
- Optional short demo GIF (keep file size small)

## Changelog entry (for v2.0.1)
**v2.0.1** — Internal improvements
- Improved debug logging: added summarized tab output and structured debug messages in `bg.js` (debug messages gated by existing `debugMode`).
- No behavior changes for end users.

## Suggested PR body (short)
This PR bumps the extension version to v2.0.1 and improves internal debug logging.

Changes:
- Bumped `manifest.json` to `2.0.1`
- Added `summarizeTab` helper and structured debug logs in `bg.js` (debug logs only when `debugMode` is enabled)
- Improved `manifest.json` short description for better discovery

Notes:
- No new permissions were requested.
- No user-facing behavior changes were made; debug output is more useful for troubleshooting.

---

If you want this file committed and pushed, I can do that and add the PR draft using this PR body. Which branch should I commit it to? (current: `feature/SupportGroups` suggested)
