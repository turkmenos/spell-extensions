let dictionaryPromise;

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

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get("enabled");
  if (settings.enabled === undefined) await chrome.storage.local.set({ enabled: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "checkWords") {
    loadDictionary()
      .then((dictionary) => {
        const known = {};
        for (const word of message.words || []) known[word] = dictionary.has(normalize(word));
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
