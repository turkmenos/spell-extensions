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
      const grammar = new Set(grammarWords.map(normalize));
      const dictionary = new Set(dictionaryRoots);
      return {
        dictionary,
        grammar,
        roots: new Set([...dictionaryRoots, ...BUILT_IN_WORDS]),
        surface: new Set([...dictionaryRoots, ...grammar, ...BUILT_IN_WORDS])
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

function inspectWord(dictionary, word) {
  const normalized = normalize(word);
  if (dictionary.dictionary.has(normalized)) return { correct: true, normalized, source: "dictionary", roots: [] };
  if (dictionary.grammar.has(normalized)) return { correct: true, normalized, source: "grammar", roots: [] };
  if (BUILT_IN_WORDS.has(normalized)) return { correct: true, normalized, source: "supplemental", roots: [] };
  const roots = TurkmenMorphology.analyze(dictionary.roots, normalized);
  if (roots.length) return { correct: true, normalized, source: "morphology", roots };
  return { correct: false, normalized, source: "unknown", roots: [] };
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

  if (message?.type === "inspectWord") {
    loadDictionary()
      .then((dictionary) => sendResponse(inspectWord(dictionary, message.word || "")))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

});
