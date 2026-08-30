(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TurkmenMorphology = api;
})(globalThis, function () {
  const FRONT_VOWELS = new Set(["ä", "e", "i", "ö", "ü"]);
  const VOWELS = new Set(["a", "ä", "e", "i", "o", "ö", "u", "ü", "y"]);

  const NOMINAL_SUFFIXES = [
    "dygy", "digi", "dugy", "dügi",
    "laryň", "leriň", "larymyz", "lerimiz", "laryňyz", "leriňiz",
    "yndaky", "indäki", "undaky", "ündäki", "ndaky", "ndäki",
    "ymyz", "imiz", "umyz", "ümiz", "yňyz", "iňiz", "uňyz", "üňiz",
    "yndan", "inden", "undan", "ünden", "ynyň", "iniň", "unyň", "üniň",
    "nyň", "niň", "nuň", "nüň", "ndan", "nden", "laryna", "lerine",
    "ynda", "inde", "unda", "ünde", "yna", "ine", "una", "üne",
    "lar", "ler", "dan", "den", "dyr", "dir", "dur", "dür",
    "yň", "iň", "uň", "üň", "ym", "im", "um", "üm",
    "myz", "miz", "ňyz", "ňiz", "syna", "sine", "suna", "süne",
    "sy", "si", "nyň", "niň", "ny", "ni", "na", "ne",
    "lyk", "lik", "luk", "lük", "ly", "li", "lu", "lü", "ky", "ki",
    "da", "de", "ň", "m", "a", "e", "y", "i"
  ];

  const PERSON_SUFFIXES = [
    "ýaňyz", "ýäňiz", "syn", "sin", "sun", "sün",
    "syňyz", "siňiz", "suňuz", "süňüz", "dyrys", "diris", "duryz", "düris",
    "dym", "dim", "dum", "düm", "dyň", "diň", "duň", "düň",
    "dyk", "dik", "duk", "dük", "dyňyz", "diňiz", "duňuz", "düňüz",
    "ýaryn", "ýärin", "ýarys", "ýäris", "ýarsyň", "ýärsiň",
    "ýarsyňyz", "ýärsiňiz", "arlar", "erler",
    "ryn", "rin", "rys", "ris", "rsyň", "rsiň", "rsyňyz", "rsiňiz",
    "yn", "in", "un", "ün", "ys", "is", "us", "üs", "yň", "iň", "uň", "üň"
  ];

  const VERB_SUFFIXES = [
    "ýandyr", "ýändir", "ýardy", "ýärdi", "jakdy", "jekdi",
    "ypdyr", "ipdir", "updyr", "üpdir", "andyr", "endir",
    "mandyr", "mändir", "mandy", "mändi", "ypdy", "ipdi", "updy", "üpdi",
    "maly", "meli", "kak", "käk", "ýäň", "ýaň", "ýar", "ýär", "jak", "jek", "ardy", "erdi", "dyr", "dir",
    "dy", "di", "du", "dü", "yp", "ip", "up", "üp", "an", "en",
    "amok", "ämok", "emok", "mok", "man", "män",
    "ar", "er", "maz", "mez", "ma", "me", "aý", "äý", "sa", "se", "dilen","pdir","äpdir",
    "ar", "er", "maz", "mez", "ma", "me",
    "aý", "äý", "sa", "se",
    "yl", "il", "ul", "ül",
    "gyn", "gin", "gun", "gün"
  ];

  const QUESTION_SUFFIXES = ["my", "mi"];
  const PARTICLE_SUFFIXES = ["ä"];

  function normalize(word) {
    return word.trim().toLocaleLowerCase("tk").replaceAll("ñ", "ň");
  }

  function isKnown(lexicon, word) {
    const normalized = normalize(word);
    if (lexicon.has(normalized)) return true;
    if (normalized.includes("-")) {
      const parts = normalized.split("-").filter(Boolean);
      if (parts.length > 1 && parts.every((part) => isKnown(lexicon, part))) return true;
    }
    return analyze(lexicon, normalized).length > 0;
  }

  function analyze(lexicon, word) {
    const start = normalize(word);
    const imperative = start + (isFront(start) ? "mek" : "mak");
    if (lexicon.has(imperative)) return [imperative];

    const queue = [{ form: start, depth: 0 }];
    const visited = new Set([start]);
    const matches = [];

    while (queue.length) {
      const current = queue.shift();
      if (current.depth > 0) {
        for (const candidate of dictionaryCandidates(current.form)) {
          if (lexicon.has(candidate)) matches.push(candidate);
        }
      }
      if (current.depth >= 4) continue;

      const suffixes = current.depth === 0
        ? [...QUESTION_SUFFIXES, ...PARTICLE_SUFFIXES, ...PERSON_SUFFIXES, ...VERB_SUFFIXES, ...NOMINAL_SUFFIXES]
        : [...VERB_SUFFIXES, ...NOMINAL_SUFFIXES];
      for (const suffix of suffixes) {
        if (!current.form.endsWith(suffix)) continue;
        const stem = current.form.slice(0, -suffix.length);
        if ([...stem].length < 2) continue;
        if (suffix === "m" && [...stem].length < 3) continue;
        for (const variant of stemVariants(stem)) {
          if (!visited.has(variant)) {
            visited.add(variant);
            queue.push({ form: variant, depth: current.depth + 1 });
          }
        }
      }
    }
    return [...new Set(matches)].sort(
      (left, right) => [...left].length - [...right].length
    );
  }

  function dictionaryCandidates(stem) {
    const candidates = [stem];
    const infinitive = isFront(stem) ? "mek" : "mak";
    candidates.push(stem + infinitive);
    return candidates;
  }

  function stemVariants(stem) {
    const variants = [stem];
    const last = stem.at(-1);
    const restored = { b: "p", d: "t", g: "k", j: "ç" }[last];
    if (restored) variants.push(stem.slice(0, -1) + restored);
    if (last === "ä") variants.push(stem.slice(0, -1) + "e");
    return variants;
  }

  function isFront(word) {
    for (let i = word.length - 1; i >= 0; i--) {
      if (VOWELS.has(word[i])) return FRONT_VOWELS.has(word[i]);
    }
    return false;
  }

  return { analyze, isKnown, normalize };
});
