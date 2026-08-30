importScripts("morphology.js");

let dictionaryPromise;

const BUILT_IN_WORDS = new Set([
  "türkmen",
  "türkmenistan",
  "türkmenistanyň",
  "türkmençe",
  "syçan",
  "ýurt",
  "saýlamak"
]);

async function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = Promise.all([
      fetchJSON("data/dictionary.json"),
      fetchJSON("data/grammar-words.json")
    ]).then(([document, grammarWords]) => new Set([
      ...Object.keys(document.words || {}).map(normalize),
      ...grammarWords.map(normalize),
      ...BUILT_IN_WORDS
    ]));
  }
  return dictionaryPromise;
}

async function fetchJSON(path) {
  const response = await fetch(chrome.runtime.getURL(path));
  if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
  return response.json();
}

function normalize(word) {
  return word.trim().toLocaleLowerCase("tk");
}

function isKnown(dictionary, word) {
  return TurkmenMorphology.isKnown(dictionary, word);
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
