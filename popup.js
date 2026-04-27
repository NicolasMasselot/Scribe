const targetLanguageSelect = document.querySelector("#target-language");
const statusElement = document.querySelector("#status");
const shortcutsButton = document.querySelector("#open-shortcuts");
const shortcutValue = document.querySelector("#shortcut-value");

loadPopupState();

targetLanguageSelect.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    targetLanguage: targetLanguageSelect.value
  });

  statusElement.textContent = "Saved";
  setTimeout(() => {
    statusElement.textContent = "";
  }, 1400);
});

shortcutsButton.addEventListener("click", async () => {
  await chrome.tabs.create({
    url: "chrome://extensions/shortcuts"
  });
  window.close();
});

async function loadPopupState() {
  const { targetLanguage } = await chrome.storage.sync.get({
    targetLanguage: ""
  });

  targetLanguageSelect.value = targetLanguage;

  const commands = await chrome.commands.getAll();
  const command = commands.find((item) => item.name === "translate-selection");
  renderShortcut(command?.shortcut || "");
}

function renderShortcut(shortcut) {
  shortcutValue.textContent = "";

  if (!shortcut) {
    shortcutValue.textContent = "Not set";
    shortcutValue.classList.add("is-empty");
    return;
  }

  shortcut.split("+").forEach((key) => {
    const keyElement = document.createElement("kbd");
    keyElement.textContent = key;
    shortcutValue.append(keyElement);
  });
}
