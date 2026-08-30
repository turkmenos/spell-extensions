(() => {
  const WORD_PATTERN = /[\p{L}]+(?:[-’'][\p{L}]+)*/gu;
  const TURKMEN_MARKERS = /[äçžňöşüý]/iu;
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"]);
  const checkedNodes = new WeakSet();
  let enabled = true;
  let scanTimer;

  chrome.storage.local.get({ enabled: true }).then((settings) => {
    enabled = settings.enabled;
    if (enabled) scan(document.body);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.enabled) return;
    enabled = changes.enabled.newValue;
    if (enabled) scan(document.body);
    else clearMarks();
  });

  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const mutation of mutations) {
      if (mutation.type === "characterData") checkedNodes.delete(mutation.target);
    }
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scan(document.body), 350);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  async function scan(root) {
    if (!root || !enabled) return;
    const nodes = collectTextNodes(root).slice(0, 500);
    const candidates = [];
    const uniqueWords = new Set();
    for (const node of nodes) {
      const words = [...node.data.matchAll(WORD_PATTERN)].map((match) => match[0]);
      if (words.length < 2) continue;
      candidates.push({ node, words });
      for (const word of words) if (word.length > 1) uniqueWords.add(word.toLocaleLowerCase("tk"));
    }
    if (!uniqueWords.size) return;

    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "checkWords", words: [...uniqueWords] });
    } catch {
      return;
    }
    if (!response?.known || !enabled) return;

    for (const candidate of candidates) {
      if (!candidate.node.isConnected || checkedNodes.has(candidate.node)) continue;
      const normalized = candidate.words.map((word) => word.toLocaleLowerCase("tk"));
      const knownCount = normalized.filter((word) => response.known[word]).length;
      const hasMarker = candidate.words.some((word) => TURKMEN_MARKERS.test(word));
      const ratio = knownCount / candidate.words.length;
      const likelyTurkmen = (knownCount >= 2 && ratio >= 0.4) || (hasMarker && knownCount >= 1 && ratio >= 0.25);
      checkedNodes.add(candidate.node);
      if (likelyTurkmen) markUnknownWords(candidate.node, response.known);
    }
    updateBadge();
  }

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !node.data.trim() || checkedNodes.has(node)) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName) || parent.closest(".turkmen-spell-error")) return NodeFilter.FILTER_REJECT;
        if (parent.isContentEditable || parent.closest("[contenteditable='true']")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function markUnknownWords(node, known) {
    const text = node.data;
    const matches = [...text.matchAll(WORD_PATTERN)];
    if (!matches.some((match) => shouldMark(match[0], known))) return;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      fragment.append(text.slice(cursor, match.index));
      if (shouldMark(match[0], known)) {
        const mark = document.createElement("span");
        mark.className = "turkmen-spell-error";
        mark.title = "Sözlükde tapylmady";
        mark.textContent = match[0];
        fragment.append(mark);
      } else fragment.append(match[0]);
      cursor = match.index + match[0].length;
    }
    fragment.append(text.slice(cursor));
    node.replaceWith(fragment);
  }

  function shouldMark(word, known) {
    return [...word].length >= 3 && !known[word.toLocaleLowerCase("tk")];
  }

  function clearMarks() {
    document.querySelectorAll(".turkmen-spell-error").forEach((mark) => mark.replaceWith(mark.textContent));
    document.body?.normalize();
    updateBadge();
  }

  function updateBadge() {
    const count = document.querySelectorAll(".turkmen-spell-error").length;
    chrome.runtime.sendMessage({ type: "setBadge", count }).catch(() => {});
  }
})();
