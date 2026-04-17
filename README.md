# Design.md Extractor — Chrome Extension

Extract design systems from any deployed website and generate a `design.md` file ready for use with **Claude Code**.

## What it does

1. **Scans the active page** — reads computed styles, CSS variables, DOM components
2. **Extracts design data** — colors, typography, spacing, border radius, shadows, breakpoints
3. **Generates design.md** — sends data to Claude API, returns a structured design system document
4. **Installs to project** — copy, download, or get an install command

## Installation (Development)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `design-extractor` folder
5. The extension icon appears in your toolbar

## Setup

1. Click the extension icon
2. Go to **Settings** tab
3. Paste your [Anthropic API key](https://console.anthropic.com)
4. Click **Save Settings**

## Usage

1. Navigate to any deployed website
2. Click the extension icon
3. (Optional) Set target directory
4. Click **Extract Design System**
5. Wait ~10-20 seconds for Claude to generate
6. **Copy** the markdown or **Download** `design.md`

## Adding to your Claude Code project

### Option A: Download + place manually
Download `design.md` and put it in your project root.

### Option B: Reference in CLAUDE.md
Add this to your `CLAUDE.md`:
```markdown
## Design System
See @design.md for the complete design system reference.
```

Claude Code will automatically use the design tokens, colors, and component patterns when building UI.

## What gets extracted

| Category | Data |
|----------|------|
| Colors | Top 20 colors by frequency, with hex values |
| Typography | Font family, size, weight, line-height per element |
| Spacing | Padding/margin values used across the page |
| Border radius | All radius values from interactive elements |
| Shadows | Box shadow definitions |
| CSS Variables | All `:root` custom properties |
| Components | Button, input, card, navigation styles |
| Breakpoints | Media query breakpoints |
| Fonts | Detected fonts + Google Fonts URLs |
| Meta | Framework (React/Vue/Next.js), CSS framework (Tailwind/Bootstrap) |

## Structure

```
design-extractor/
├── manifest.json          # Extension config
├── popup/
│   ├── popup.html         # Extension popup UI
│   └── popup.js           # Popup logic
├── content/
│   └── extractor.js       # Injected into pages, extracts design data
├── background/
│   └── service_worker.js  # Handles Claude API calls
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Requirements

- Chrome 88+ (Manifest V3)
- Anthropic API key with access to `claude-opus-4-5`

## Notes

- Works on any publicly accessible page
- Pages behind login work if you're already logged in
- JavaScript-rendered content is fully supported (reads from DOM, not source HTML)
- Cross-origin stylesheets may limit CSS variable extraction
