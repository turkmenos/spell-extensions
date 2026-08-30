const enabled = document.querySelector("#enabled");
const status = document.querySelector("#status");

chrome.storage.local.get({ enabled: true }).then((settings) => {
  enabled.checked = settings.enabled;
});

enabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabled.checked });
  status.textContent = enabled.checked ? "Barlag işjeň" : "Barlag öçürildi";
});

chrome.runtime.sendMessage({ type: "checkWords", words: ["abadan"] }).then((response) => {
  if (response?.error) throw new Error(response.error);
  status.textContent = `Barlag taýýar · ${response.dictionarySize.toLocaleString("tk")} söz`;
}).catch(() => {
  status.textContent = "Sözlük açylmady";
  status.classList.add("error");
});
