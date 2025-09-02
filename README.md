# MRUTab
Most Recently Used Tab Stack — keep the tab you last used within easy reach by automatically moving it to the front or end of your tab strip.

## Features

- Auto-move the most recently used tab to the front or end of the tab strip
- Respects pinned tabs and Chrome tab groups
- Configurable delay and ordering in Options
- Lightweight and privacy-first — no external servers

## Installation / Development

- Load as an unpacked extension in `chrome://extensions` (Developer mode) using the project root.
- The Options page (`options.html`) lets you configure delay and ordering.

## Permissions

This extension intentionally requests only the `storage` permission. It uses Chrome tab activation events and non-sensitive tab metadata (id, index, groupId, title) to perform moves — no browsing data is uploaded and no `tabs` or host permissions are requested.

## Changelog

- **2.0.2** — Removed extension-registered commands to keep permissions minimal; improved debug logging and non-sensitive tab summaries.
- **2.0.1** — Improved debug logging (summarizeTab and structured debug messages).
- **2.0.0** — Added support for tab groups and left/right ordering.

## Store description (short)
MRU Tab Stack — Lightweight tab manager that auto-moves your most recently used tab to the front or back; supports pinned tabs, tab groups, and keyboard shortcuts.

## Links

- Options / in-extension changelog: `options.html`
- Store listing copy: `store_description.md`
- Source & issues: https://github.com/BMeyerKC/MRUTab

