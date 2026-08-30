importScripts("morphology.js");

let dictionaryPromise;
let obsceneWordsPromise;
let obsceneSitesPromise;

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
  "poz",
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
  "ýetişmek",
  "şu",
  "kesel",
  "otag"
]);

async function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = Promise.all([
      fetchJSON("data/dictionary-1.json"),
      fetchJSON("data/dictionary-2.json"),
      fetchJSON("data/grammar-words.json"),

      fetchJSON("data/json/nouns.json"),
      fetchJSON("data/json/adjectives.json"),
      fetchJSON("data/json/numerals.json"),
      fetchJSON("data/json/pronouns.json"),
      fetchJSON("data/json/verbs.json"),
      fetchJSON("data/json/adverbs.json")
    ]).then(([
      dictionaryPart1,
      dictionaryPart2,
      grammarWords,
      nouns,
      adjectives,
      numerals,
      pronouns,
      verbs,
      adverbs
    ]) => {
      const dictionaryRoots = [dictionaryPart1, dictionaryPart2]
        .flatMap((document) => Object.keys(document.words || document))
        .map(normalize);
      const grammar = new Set(grammarWords.map(normalize));
      const dictionary = new Set(dictionaryRoots);

      return {
        dictionary,
        grammar,

        morphology: {
          nouns,
          adjectives,
          numerals,
          pronouns,
          verbs,
          adverbs
        },

        roots: new Set([...dictionaryRoots, ...grammar, ...BUILT_IN_WORDS]),
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

async function loadObsceneWords() {
  if (!obsceneWordsPromise) {
    obsceneWordsPromise = fetchJSON("data/obscene-words.json").then((document) =>
      (Array.isArray(document) ? document : document.words || []).map(normalize)
    );
  }
  return obsceneWordsPromise;
}

async function loadObsceneSites() {
  if (!obsceneSitesPromise) {
    obsceneSitesPromise = fetchJSON("data/obscene-sites.json").then((document) =>
      (Array.isArray(document) ? document : document.sites || [])
        .map(normalizeSite)
        .filter(Boolean)
    );
  }
  return obsceneSitesPromise;
}

function normalizeSite(site) {
  const value = String(site).trim();
  if (!value) return "";
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLocaleLowerCase("en").replace(/^www\./u, "");
  } catch {
    return "";
  }
}

function normalize(word) {
  return TurkmenMorphology.normalize(word);
}

function isKnown(dictionary, word) {
  const normalized = normalize(word);
  return dictionary.surface.has(normalized) || TurkmenMorphology.isKnown(dictionary.roots, normalized);
}

function findSuggestion(dictionary, word) {
  const normalized = normalize(word);
  const vowels = ["a", "ä", "e", "i", "o", "ö", "u", "ü", "y"];
  const letters = [...normalized];
  const diacriticAlternatives = {
    a: "ä", ä: "a",
    o: "ö", ö: "o",
    u: "ü", ü: "u",
    y: "ý", ý: "y",
    s: "ş", ş: "s",
    n: "ň", ň: "n",
    c: "ç", ç: "c",
    z: "ž", ž: "z"
  };

  const structuralForms = [letters];
  if (/[yý][aä]s$/u.test(normalized)) {
    const stem = normalized.slice(0, -3);
    structuralForms.push([...(stem + "ýarys")]);
    structuralForms.push([...(stem + "ýäris")]);
  }

  for (const form of structuralForms.slice(1)) {
    const suggestion = form.join("");
    if (isKnown(dictionary, suggestion)) return suggestion;
    for (let index = form.length - 1; index >= 0; index--) {
      const replacement = diacriticAlternatives[form[index]];
      if (!replacement) continue;
      const corrected = [...form];
      corrected[index] = replacement;
      const correctedSuggestion = corrected.join("");
      if (isKnown(dictionary, correctedSuggestion)) return correctedSuggestion;
    }
  }

  let candidates = structuralForms;
  const visited = new Set([normalized]);
  const morphologySuggestions = [];
  const spellingCandidates = [...structuralForms];
  for (let depth = 0; depth < 3; depth++) {
    const nextCandidates = [];
    for (const candidate of candidates) {
      for (let index = candidate.length - 1; index >= 0; index--) {
        const replacement = diacriticAlternatives[candidate[index]];
        if (!replacement) continue;
        const next = [...candidate];
        next[index] = replacement;
        const suggestion = next.join("");
        if (visited.has(suggestion)) continue;
        visited.add(suggestion);
        if (dictionary.surface.has(suggestion)) return suggestion;
        if (TurkmenMorphology.isKnown(dictionary.roots, suggestion)) {
          morphologySuggestions.push({ suggestion, depth: depth + 1 });
        }
        nextCandidates.push(next);
        spellingCandidates.push(next);
      }
    }
    candidates = nextCandidates;
  }

  for (const candidate of spellingCandidates) {
    const form = candidate.join("");
    if (/m[yi]$/u.test(form)) {
      for (const letter of ["y", "i"]) {
        const suggestion = form.slice(0, -2) + letter + form.slice(-2);
        if (dictionary.surface.has(suggestion)) return suggestion;
        if (TurkmenMorphology.isKnown(dictionary.roots, suggestion)) return suggestion;
      }
    }
  }

  if (morphologySuggestions.length) {
    morphologySuggestions.sort((left, right) => right.depth - left.depth);
    return morphologySuggestions[0].suggestion;
  }

  for (let index = letters.length - 1; index >= 0; index--) {
    if (!vowels.includes(letters[index])) continue;

    for (const vowel of vowels) {
      if (vowel === letters[index]) continue;
      const candidate = [...letters];
      candidate[index] = vowel;
      const suggestion = candidate.join("");
      if (isKnown(dictionary, suggestion)) return suggestion;
    }
  }

  return null;
}

function inspectWord(dictionary, word) {
  const normalized = normalize(word);
  if (dictionary.dictionary.has(normalized)) return { correct: true, normalized, source: "dictionary", roots: [] };
  if (dictionary.grammar.has(normalized)) return { correct: true, normalized, source: "grammar", roots: [] };
  if (BUILT_IN_WORDS.has(normalized)) return { correct: true, normalized, source: "supplemental", roots: [] };
  const roots =TurkmenMorphology.analyze(dictionary.roots, normalized, dictionary.morphology);
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
        const suggestions = {};
        for (const word of message.words || []) {
          known[word] = isKnown(dictionary, word);
          if (!known[word] && [...word].length >= 3) {
            const suggestion = findSuggestion(dictionary, word);
            if (suggestion) suggestions[word] = suggestion;
          }
        }
        sendResponse({ known, suggestions });
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

  if (message?.type === "getObsceneWords") {
    Promise.all([loadObsceneWords(), loadObsceneSites()])
      .then(([words, sites]) => sendResponse({ words, sites }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

});
