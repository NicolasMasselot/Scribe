# Scribe

Chrome Manifest V3 extension that translates selected web page text into a temporary visual overlay. The page DOM is not changed; the original text remains underneath and the overlay disappears when the selection is cleared or Escape is pressed.

## Load Unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this `selection-translator` folder.

## Configure Target Language

1. Click the Scribe extension icon.
2. Choose a target language in the popup.

The selected language is stored in `chrome.storage.sync`. If no language is selected, the extension uses Chrome's UI language.

## Use

1. Select text on a regular `http` or `https` page.
2. Use the keyboard shortcut shown in the popup.
3. The translation appears near the selected text.
4. Press Escape or clear the selection to remove it.

The shortcut can be changed from the popup or at `chrome://extensions/shortcuts`.

## Current Limitations

- Requires Chrome 138+ for the local Translator and Language Detector APIs.
- If local translation is unavailable, the overlay reports that translation is unavailable.
- No remote translation backend is included.
- Regular document selections only; textareas, inputs, iframes, shadow DOM, PDFs, Chrome Web Store pages, and `chrome://` pages are not supported.
- Long translations are shown in a constrained scrollable overlay.
- Multi-line selection positioning is approximate.

## Architecture

- `manifest.json` defines the MV3 extension, command, popup, options page, icons, and permissions: `activeTab`, `scripting`, and `storage`.
- `background.js` handles the keyboard command and asks the active tab to translate the current selection.
- `content.js` reads the current selection, validates selection text, manages overlay lifecycle, and calls the translation service.
- `translator.js` exposes a small provider interface with a Chrome local provider and an unavailable fallback provider. Selected text stays on device in V1.
- `popup.html`, `popup.css`, and `popup.js` provide Scribe onboarding, target-language selection, and shortcut access.
- `options.html` and `options.js` remain as a simple fallback options page.

## V2 Candidates

- Better support for multi-line overlays, iframes, shadow DOM, and editable fields.
- Optional explicit remote provider architecture with clear privacy controls.
- Better language-pair availability messaging.
- Manual source-language override.
- Small integration test page and browser automation checks.
