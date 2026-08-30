# Turkmen Spell Checker

A privacy-friendly Turkmen spell-checking extension for Chrome and other
Chromium-based browsers. It detects likely Turkmen text on social media pages
and marks words that are missing from the bundled dictionary with a red wavy
underline.

The dictionary is processed locally. Text from visited pages is never sent to a
remote API or server.

## Features

- Detects likely Turkmen text instead of marking every language on the page
- Checks words against a bundled dictionary containing over 18,000 headwords
- Supports Turkmen characters: `ä`, `ç`, `ž`, `ň`, `ö`, `ş`, `ü`, and `ý`
- Watches dynamically loaded social media posts
- Displays the number of detected spelling issues on the extension badge
- Can be enabled or disabled from the extension popup
- Works without an internet connection after installation

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** in the upper-right corner.
4. Select **Load unpacked**.
5. Choose the repository directory.
6. Reload any social media pages that were already open.

## How it works

The background service worker loads `data/dictionary.json` once and creates an
in-memory set for fast, case-insensitive lookups. The content script examines
visible text nodes and estimates whether a text block is Turkmen by considering
dictionary matches and Turkmen-specific characters. Unknown words in likely
Turkmen text are then underlined.

The extension also observes DOM changes, allowing it to process posts that
appear while scrolling.

## Current limitation

Turkmen morphology is not implemented yet. Correct inflected or derived words
that do not appear as standalone dictionary entries may therefore be marked as
unknown. Improving morphology support is the next major milestone.

## Project structure

- `data/dictionary.json` — bundled Turkmen dictionary
- `background.js` — dictionary loader and lookup service worker
- `content.js` — language detection and page annotation
- `content.css` — spelling-error underline styles
- `popup.html`, `popup.css`, `popup.js` — extension controls
- `manifest.json` — Chrome Manifest V3 configuration

## Privacy

All spell checking happens inside the browser. The extension does not collect,
store, or transmit page content.
