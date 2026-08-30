let dictionaryPromise;

const BUILT_IN_WORDS = new Set([
  "türkmen",
  "türkmenistan",
  "türkmenistanyň",
  "türkmençe"
]);

// Conservative suffix handling for common inflected forms. A stripped form is
// accepted only when the resulting stem exists in the dictionary.
const SUFFIXES = [
  "laryň", "leriň", "lardan", "lerden", "larda", "lerde",
  "ymyzyň", "imiziň", "umiziň", "ümiziň",
  "ymyz", "imiz", "umyz", "ümiz",
  "ynyň", "iniň", "unyň", "üniň",
  "yndan", "inden", "undan", "ünden",
  "ynda", "inde", "unda", "ünde",
  "yna", "ine", "una", "üne",
  "lar", "ler", "dan", "den", "da", "de",
  "yň", "iň", "uň", "üň", "sy", "si"
];

async function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = fetch(chrome.runtime.getURL("data/dictionary.json"))
      .then((response) => {
        if (!response.ok) throw new Error(`Dictionary load failed: ${response.status}`);
        return response.json();
      })
      .then((document) => new Set(Object.keys(document.words || {}).map(normalize)));
  }
  return dictionaryPromise;
}

function normalize(word) {
  return word.trim().toLocaleLowerCase("tk");
}

function isKnown(dictionary, word) {
  const normalized = normalize(word);
  if (dictionary.has(normalized) || BUILT_IN_WORDS.has(normalized)) return true;

  for (const suffix of SUFFIXES) {
    if (!normalized.endsWith(suffix)) continue;
    const stem = normalized.slice(0, -suffix.length);
    if ([...stem].length >= 3 && dictionary.has(stem)) return true;
  }
  return false;
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get("enabled");
  if (settings.enabled === undefined) await chrome.storage.local.set({ enabled: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "checkWords") {
    loadDictionary()
      .then((dictionary) => {
        const known = {};
        for (const word of message.words || []) known[word] = isKnown(dictionary, word);
        sendResponse({ known, dictionarySize: dictionary.size });
      })
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message?.type === "setBadge" && sender.tab?.id !== undefined) {
    const count = Number(message.count) || 0;
    chrome.action.setBadgeBackgroundColor({ color: "#d93025", tabId: sender.tab.id });
    chrome.action.setBadgeText({ text: count ? String(Math.min(count, 99)) : "", tabId: sender.tab.id });
  }
});
