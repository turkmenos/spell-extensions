importScripts("morphology.js");

let dictionaryPromise;

const BUILT_IN_WORDS = new Set([
  "türkmen",
  "türkmenistan",
  "türkmenistanyň",
  "türkmençe",
  "syçan",
  "ýurt",
  "saýlamak",
  "unutmak",
  "minnet",
  "näsag",
  "professor",
  "ýokanç",
  "utanmak",
  "çekinmek",
  "ýardam",
  "ýyly",
  "ýaş",
  "saç",
  "kitap",
  "mekdep",
  "okamak",
  "şu",
  "kesel",
  "otag"
]);

async function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = Promise.all([
      fetchJSON("data/dictionary.json"),
      fetchJSON("data/grammar-words.json")
    ]).then(([document, grammarWords]) => {
      const dictionaryRoots = Object.keys(document.words || {}).map(normalize);
      return {
        roots: new Set([...dictionaryRoots, ...BUILT_IN_WORDS]),
        surface: new Set([...dictionaryRoots, ...grammarWords.map(normalize), ...BUILT_IN_WORDS])
      };
    });
  }
  return dictionaryPromise;
}

async function fetchJSON(path) {
  const response = await fetch(chrome.runtime.getURL(path));
  if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
  return response.json();
}

function normalize(word) {
  return TurkmenMorphology.normalize(word);
}

function isKnown(dictionary, word) {
  const normalized = normalize(word);
  return dictionary.surface.has(normalized) || TurkmenMorphology.isKnown(dictionary.roots, normalized);
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
        sendResponse({ known });
      })
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

});
