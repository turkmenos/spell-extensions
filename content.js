(() => {
  const WORD_PATTERN = /[\p{L}]+(?:[-’'][\p{L}]+)*/gu;
  const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}|\b[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+\b/giu;
  const OBSCENE_WORD_PATTERN = /[\p{L}]+(?:[-’'*._][\p{L}]+)*/gu;
  const WEB_TOKENS = new Set(["http", "https", "www", "ssl", "com", "net", "org"]);
  const OBSCENE_SUFFIXES = new Set([
    "lar", "ler", "y", "i", "ny", "ni", "a", "e",
    "da", "de", "ta", "te", "dan", "den", "tan", "ten",
    "yň", "iň", "uň", "üň", "ym", "im", "um", "üm"
  ]);

  const TURKMEN_MARKERS = /[äžňý]/iu;
  const TURKISH_MARKERS = /[ığ]/iu;

  const TURKMEN_CONTEXT = new Set([
    "üçin",
    "bilen",
    "ýaly",
    "ýene",
    "şeýle",
    "şol",
    "hem",
    "däl",
    "diýip",
    "bolsa",
    "türkmen",
    "örän",
    "çünki",
    "emma",
    "eýsem",
    "degişli",
    "halypa",
    "welin",
    "nähili",
    "näme",
    "şundan"
  ]);

  const TURKISH_CONTEXT = new Set(
    [
      "için",
      "ile",
      "gibi",
      "değil",
      "çünkü",
      "ama",
      "olarak",
      "olan",
      "veya",
      "Türkçe",
      "şey",
      "daha",
      "yatırım",
      "tavsiye",
      "tavsiyesi"
    ].map((word) => word.toLocaleLowerCase("tr"))
  );

  const ENGLISH_CONTEXT = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "your",
    "you",
    "are",
    "not",
    "have",
    "will",
    "can",
    "but",
    "more"
  ]);

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "CODE",
    "PRE"
  ]);

  const SKIP_SELECTOR =
    "a[href], code, pre, kbd, samp, var, [data-language], [class*='language-'], [class*='highlight'], [class*='code-block'], [data-testid*='code'], .turkmen-obscene-word, .turkmen-foreign-word";

  const checkedNodes = new WeakSet();

  let enabled = true;
  let obsceneWords = new Set();
  let obsceneEnabled = true;
  let obsceneSites = [];
  let scanTimer;

  document.addEventListener("click", async (event) => {
    const obscured = event.target.closest?.(".turkmen-obscene-word");
    if (obscured) {
      obscured.classList.toggle("revealed");
      return;
    }

    const mark = event.target.closest?.(".turkmen-spell-error");

    if (!mark) return;

    const word = mark.textContent.trim();

    if (!word) return;

    try {
      const { morphologyCandidates = [] } =
        await chrome.storage.local.get({
          morphologyCandidates: []
        });

      const normalized = word.toLocaleLowerCase("tk");

      const alreadyExists = morphologyCandidates.some(
        (item) => item.toLocaleLowerCase("tk") === normalized
      );

      if (!alreadyExists) {
        morphologyCandidates.push(word);

        await chrome.storage.local.set({
          morphologyCandidates
        });
      }

      mark.title = "Morfologiýa üçin ýazga alyndy";

      console.log("[spell] morphology candidate saved:", word);
    } catch (error) {
      console.error("[spell] save failed:", error);
    }
  });

  chrome.storage.local
    .get({
      enabled: true,
      obsceneEnabled: true
    })
    .then(async (settings) => {
      enabled = settings.enabled;
      obsceneEnabled = settings.obsceneEnabled;
      const response = await chrome.runtime.sendMessage({ type: "getObsceneWords" });
      obsceneWords = new Set(response?.words || []);
      obsceneSites = response?.sites || [];

      clearMarks();

      scan(document.body);
    });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.obsceneEnabled) {
      if (changes.obsceneEnabled) obsceneEnabled = changes.obsceneEnabled.newValue;
      removeObsceneMarks();
      scan(document.body);
    }

    if (!changes.enabled) return;

    enabled = changes.enabled.newValue;

    if (enabled) {
      scan(document.body);
    } else {
      removeExistingMarks();
    }
  });

  const observer = new MutationObserver((mutations) => {
    if (!isConfiguredSite() || (!enabled && !isObsceneMaskingActive())) return;

    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        checkedNodes.delete(mutation.target);
      }
    }

    clearTimeout(scanTimer);

    scanTimer = setTimeout(() => {
      scan(document.body);
    }, 350);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  async function scan(root) {
    if (!root) return;
    if (!isConfiguredSite()) {
      clearMarks();
      return;
    }

    if (isObsceneMaskingActive()) maskObsceneWords(root);
    if (!enabled) return;

    const nodes = collectTextNodes(root).slice(0, 500);

    const candidates = [];
    const uniqueWords = new Set();

    for (const node of nodes) {
      const words = getWordMatches(node.data).map(
        (match) => match[0]
      );

      if (words.length < 2) continue;

      candidates.push({
        node,
        words
      });

      for (const word of words) {
        if (word.length <= 1) continue;

        uniqueWords.add(
          word.toLocaleLowerCase("tk")
        );
      }
    }

    if (!uniqueWords.size) return;

    let response;

    try {
      response = await chrome.runtime.sendMessage({
        type: "checkWords",
        words: [...uniqueWords]
      });

      console.log("[spell] checkWords response:", response);
    } catch (error) {
      console.error("[spell] checkWords failed:", error);
      return;
    }

    if (!response?.known || !enabled) return;

    for (const candidate of candidates) {
      if (
        !candidate.node.isConnected ||
        checkedNodes.has(candidate.node)
      ) {
        continue;
      }

      const normalized = candidate.words.map((word) =>
        word.toLocaleLowerCase("tk")
      );

      const knownCount = normalized.filter(
        (word) => response.known[word]
      ).length;

      const ratio =
        knownCount / candidate.words.length;

      const likelyTurkmen = isLikelyTurkmen(
        candidate.words,
        knownCount,
        ratio
      );

      console.log("[spell] candidate:", {
        words: candidate.words,
        knownCount,
        ratio,
        likelyTurkmen
      });

      checkedNodes.add(candidate.node);

      if (likelyTurkmen) {
        markUnknownWords(
          candidate.node,
          response.known,
          response.suggestions || {}
        );
      }
    }
  }

  function isLikelyTurkmen(
    words,
    knownCount,
    ratio
  ) {
    const normalized = words.map((word) =>
      word.toLocaleLowerCase("tk")
    );
    const hasTurkmenSignal = words.some(
      (word, index) =>
        TURKMEN_MARKERS.test(word) ||
        TURKMEN_CONTEXT.has(normalized[index])
    );
    const hasForeignSignal = words.some(
      (word) =>
        TURKISH_MARKERS.test(word) ||
        TURKISH_CONTEXT.has(word.toLocaleLowerCase("tr")) ||
        ENGLISH_CONTEXT.has(word.toLocaleLowerCase("en"))
    );

    if (hasForeignSignal && !hasTurkmenSignal) return false;
    return knownCount >= 1 || hasTurkmenSignal;
  }

  function collectTextNodes(root) {
    const nodes = [];

    const walker =
      document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent =
              node.parentElement;

            if (
              !parent ||
              !node.data.trim() ||
              checkedNodes.has(node)
            ) {
              return NodeFilter.FILTER_REJECT;
            }

            if (
              SKIP_TAGS.has(parent.tagName) ||
              parent.closest(SKIP_SELECTOR) ||
              parent.closest(
                ".turkmen-spell-error"
              )
            ) {
              return NodeFilter.FILTER_REJECT;
            }

            if (
              parent.isContentEditable ||
              parent.closest(
                "[contenteditable='true']"
              )
            ) {
              return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    return nodes;
  }

  function markUnknownWords(
    node,
    known,
    suggestions
  ) {
    const text = node.data;

    const matches = getWordMatches(text);

    const markableMatches = new Set();
    const foreignMatches = new Set();

    for (const clause of groupMatchesByClause(text, matches)) {
      const words = clause.map((match) => match[0]);
      const knownCount = words.filter((word) =>
        known[word.toLocaleLowerCase("tk")]
      ).length;

      if (isLikelyTurkmen(words, knownCount, knownCount / words.length)) {
        for (const match of clause) markableMatches.add(match);
      } else {
        for (const match of clause) {
          const normalized = match[0].toLocaleLowerCase("en");
          if ([...match[0]].length > 1 && !WEB_TOKENS.has(normalized)) {
            foreignMatches.add(match);
          }
        }
      }
    }

    const hasUnknown = matches.some(
      (match) =>
        foreignMatches.has(match) ||
        (markableMatches.has(match) && shouldMark(match[0], known))
    );

    if (!hasUnknown) return;

    const fragment =
      document.createDocumentFragment();

    let cursor = 0;

    for (const match of matches) {
      fragment.append(
        text.slice(cursor, match.index)
      );

      const isForeign = foreignMatches.has(match);
      const isMisspelled =
        markableMatches.has(match) && shouldMark(match[0], known);

      if (isForeign || isMisspelled) {
        const mark =
          document.createElement("span");

        mark.className = isForeign
          ? "turkmen-foreign-word"
          : "turkmen-spell-error";

        const normalized =
          match[0].toLocaleLowerCase("tk");

        mark.title = isForeign
          ? "Başga dil"
          : suggestions[normalized]
            ? `Dogrusy: ${suggestions[normalized]}`
            : "Sözlükde tapylmady";

        mark.textContent =
          match[0];

        fragment.append(mark);
      } else {
        fragment.append(match[0]);
      }

      cursor =
        match.index +
        match[0].length;
    }

    fragment.append(
      text.slice(cursor)
    );

    node.replaceWith(fragment);
  }

  function groupMatchesByClause(text, matches) {
    const clauses = [];
    let clause = [];
    let previousEnd = 0;

    for (const match of matches) {
      const gap = text.slice(previousEnd, match.index);
      if (clause.length && /[.!?,;:…\n]/u.test(gap)) {
        clauses.push(clause);
        clause = [];
      }
      clause.push(match);
      previousEnd = match.index + match[0].length;
    }

    if (clause.length) clauses.push(clause);
    return clauses;
  }

  function getWordMatches(text) {
    const urlRanges = [...text.matchAll(URL_PATTERN)].map((match) => ({
      start: match.index,
      end: match.index + match[0].length
    }));
    return [...text.matchAll(WORD_PATTERN)].filter((match) =>
      !urlRanges.some((range) =>
        match.index >= range.start && match.index < range.end
      )
    );
  }

  function shouldMark(
    word,
    known
  ) {
    const looksLikeProperName =
      /^\p{Lu}/u.test(word);

    if (
      [...word].length < 3 ||
      looksLikeProperName
    ) {
      return false;
    }

    const normalized =
      word.toLocaleLowerCase("tk");

    if (WEB_TOKENS.has(word.toLocaleLowerCase("en"))) return false;

    const looksTurkish =
      TURKISH_MARKERS.test(word) ||
      TURKISH_CONTEXT.has(
        word.toLocaleLowerCase("tr")
      );

    if (looksTurkish) return false;

    const isKnown =
      Boolean(known[normalized]);

    console.log(
      "[spell] shouldMark:",
      {
        word,
        normalized,
        isKnown
      }
    );

    return !isKnown;
  }

  function clearMarks() {
    removeExistingMarks();
    removeObsceneMarks();
  }

  function maskObsceneWords(root) {
    if (!obsceneWords.size) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (
            !parent ||
            !node.data.trim() ||
            SKIP_TAGS.has(parent.tagName) ||
            parent.closest(SKIP_SELECTOR) ||
            parent.closest(".turkmen-spell-error")
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const text = node.data;
      const matches = [...text.matchAll(OBSCENE_WORD_PATTERN)];
      if (!matches.some((match) => isObsceneWord(match[0]))) continue;

      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const match of matches) {
        fragment.append(text.slice(cursor, match.index));
        if (isObsceneWord(match[0])) {
          const span = document.createElement("span");
          span.className = "turkmen-obscene-word";
          span.title = "Görmek üçin basyň";
          span.textContent = match[0];
          fragment.append(span);
        } else {
          fragment.append(match[0]);
        }
        cursor = match.index + match[0].length;
      }
      fragment.append(text.slice(cursor));
      node.replaceWith(fragment);
    }
  }

  function isObsceneMaskingActive() {
    return obsceneEnabled && isConfiguredSite();
  }

  function isConfiguredSite() {
    if (!obsceneSites.length) return false;
    const hostname = location.hostname.toLocaleLowerCase("en");
    return obsceneSites.some((site) =>
      hostname === site || hostname.endsWith(`.${site}`)
    );
  }

  function isObsceneWord(word) {
    const normalized = word.toLocaleLowerCase("tk");
    if (obsceneWords.has(normalized)) return true;

    for (const root of obsceneWords) {
      if (!normalized.startsWith(root)) continue;
      const suffix = normalized.slice(root.length);
      if (OBSCENE_SUFFIXES.has(suffix)) return true;
    }

    return false;
  }

  function removeObsceneMarks() {
    document.querySelectorAll(".turkmen-obscene-word").forEach((mark) =>
      mark.replaceWith(mark.textContent)
    );
    document.body?.normalize();
  }

  function removeExistingMarks() {
    document
      .querySelectorAll(
        ".turkmen-spell-error, .turkmen-foreign-word"
      )
      .forEach((mark) =>
        mark.replaceWith(
          mark.textContent
        )
      );

    document.body?.normalize();
  }
})();
