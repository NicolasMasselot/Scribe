chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "translate-selection") {
    return;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    return;
  }

  await translateInTab(tab.id);
});

async function ensureContentScript(tabId) {
  const [{ result: alreadyLoaded }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => Boolean(self.__selectionTranslatorContentLoaded)
  });

  if (alreadyLoaded) {
    return;
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["styles.css"]
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["translator.js", "content.js"]
  });
}

async function translateInTab(tabId) {
  try {
    await sendTranslateMessage(tabId);
  } catch {
    try {
      await ensureContentScript(tabId);
      await sendTranslateMessage(tabId);
    } catch (error) {
      // Happens on restricted pages such as chrome://, the Web Store, browser PDFs, or pages without script access.
      console.debug("Scribe: cannot run on this tab", error);
    }
  }
}

async function sendTranslateMessage(tabId) {
  await chrome.tabs.sendMessage(tabId, {
    type: "TRANSLATE_SELECTION"
  });
}
