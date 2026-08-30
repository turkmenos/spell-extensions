const enabled = document.querySelector("#enabled");
const status = document.querySelector("#status");
const statusDetail = document.querySelector("#dictionary-count");
const statusCard = document.querySelector(".status-card");
let dictionarySize;

function renderStatus(isEnabled) {
  statusCard.className = `status-card ${isEnabled ? "ready" : "disabled"}`;
  status.textContent = isEnabled ? "Barlag işjeň" : "Barlag öçürildi";
  statusDetail.textContent = dictionarySize
    ? `${dictionarySize.toLocaleString("tk")} söz · Ýerli barlag`
    : "Ýerli sözlük ýüklenýär";
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
  dictionarySize = response.dictionarySize;
  renderStatus(enabled.checked);
}).catch(() => {
  status.textContent = "Sözlük açylmady";
  statusDetail.textContent = "Extension-y täzeden ýükläp görüň";
  statusCard.className = "status-card error";
});
