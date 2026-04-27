const targetLanguageSelect = document.querySelector("#target-language");
const statusElement = document.querySelector("#status");

loadOptions();

targetLanguageSelect.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    targetLanguage: targetLanguageSelect.value
  });

  statusElement.textContent = "Saved.";
  setTimeout(() => {
    statusElement.textContent = "";
  }, 1500);
});

async function loadOptions() {
  const { targetLanguage } = await chrome.storage.sync.get({
    targetLanguage: ""
  });

  targetLanguageSelect.value = targetLanguage;
}
