const enabled = document.querySelector("#enabled");
const status = document.querySelector("#status");
const statusDetail = document.querySelector("#status-detail");
const statusCard = document.querySelector(".status-card");
document.querySelector("#version").textContent = `v${chrome.runtime.getManifest().version}`;
const wordForm = document.querySelector("#word-form");
const wordInput = document.querySelector("#word-input");
const wordResult = document.querySelector("#word-result");
const resultTitle = document.querySelector("#result-title");
const resultDetail = document.querySelector("#result-detail");
const obsceneEnabled = document.querySelector("#obscene-enabled");
const obsceneSiteList = document.querySelector("#obscene-site-list");

chrome.storage.local.get({ obsceneEnabled: true }).then((settings) => {
  obsceneEnabled.checked = settings.obsceneEnabled;
});

chrome.runtime.sendMessage({ type: "getObsceneWords" }).then((response) => {
  const sites = response?.sites || [];
  obsceneSiteList.replaceChildren();
  if (!sites.length) {
    obsceneSiteList.textContent = "Hiç bir saýt goşulmady";
    return;
  }
  for (const site of sites) {
    const item = document.createElement("span");
    item.textContent = site;
    obsceneSiteList.append(item);
  }
}).catch(() => {
  obsceneSiteList.textContent = "Saýt sanawyny ýükläp bolmady";
});

obsceneEnabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ obsceneEnabled: obsceneEnabled.checked });
});


function renderStatus(isEnabled) {
  statusCard.className = `status-card ${isEnabled ? "ready" : "disabled"}`;
  status.textContent = isEnabled ? "Barlag işjeň" : "Barlag öçürildi";
  statusDetail.textContent = "Diňe türkmençe tekstler üçin";
}

chrome.storage.local.get({ enabled: true }).then((settings) => {
  enabled.checked = settings.enabled;
  renderStatus(settings.enabled);
});

enabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabled.checked });
  renderStatus(enabled.checked);
});

chrome.runtime.sendMessage({ type: "checkWords", words: ["abadan"] }).then((response) => {
  if (response?.error) throw new Error(response.error);
  renderStatus(enabled.checked);
}).catch(() => {
  status.textContent = "Sözlük açylmady";
  statusDetail.textContent = "Extension-y täzeden ýükläp görüň";
  statusCard.className = "status-card error";
});

wordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const word = wordInput.value.trim();
  if (!word) {
    wordInput.focus();
    return;
  }

  resultTitle.textContent = "Barlanýar…";
  resultDetail.textContent = "";
  wordResult.className = "word-result";
  wordResult.hidden = false;

  try {
    const result = await chrome.runtime.sendMessage({ type: "inspectWord", word });
    if (result?.error) throw new Error(result.error);
    wordResult.className = `word-result ${result.correct ? "correct" : "incorrect"}`;
    resultTitle.textContent = result.correct ? "Türkmençe dogry" : "Sözlükde tapylmady";
    if (result.source === "morphology" && result.roots?.length) {
      resultDetail.textContent = `Asly: ${result.roots[0]}`;
    } else if (result.source === "dictionary") {
      resultDetail.textContent = `Asly: ${result.normalized}`;
    } else if (result.source === "grammar") {
      resultDetail.textContent = `Asly: ${result.normalized}`;
    } else {
      resultDetail.textContent = result.correct ? "Türkmençe söz hökmünde tanaldy" : "Ýazylyşyny barlap görüň";
    }
  } catch {
    wordResult.className = "word-result incorrect";
    resultTitle.textContent = "Barlap bolmady";
    resultDetail.textContent = "Extension-y täzeden ýükläp görüň";
  }
});
