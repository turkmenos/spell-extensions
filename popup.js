const enabled = document.querySelector("#enabled");
const status = document.querySelector("#status");
const statusDetail = document.querySelector("#status-detail");
const statusCard = document.querySelector(".status-card");
document.querySelector("#version").textContent = `v${chrome.runtime.getManifest().version}`;

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
