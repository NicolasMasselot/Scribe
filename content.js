(async () => {
const DEFAULT_TARGET_LANGUAGE = "en";

if (self.__selectionTranslatorContentLoaded) {
  return;
}

self.__selectionTranslatorContentLoaded = true;

let overlay = null;
let lastSelectionText = "";
let requestId = 0;
const translationService = new SelectionTranslator.TranslationService([
  new SelectionTranslator.providers.ChromeLocalTranslatorProvider(),
  new SelectionTranslator.providers.UnavailableTranslatorProvider()
]);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "TRANSLATE_SELECTION") {
    void translateSelection();
  }
});

document.addEventListener("selectionchange", () => {
  const text = getSelectionText();

  if (!text) {
    dismissUI();
    return;
  }

  if (overlay && text !== lastSelectionText) {
    removeOverlay();
  }
});

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") {
      dismissUI();
    }
  },
  true
);

window.addEventListener("resize", dismissUI);
window.addEventListener("scroll", repositionOverlay, {
  passive: true,
  capture: true
});
window.addEventListener("pagehide", dismissUI);
window.addEventListener("beforeunload", dismissUI);
window.addEventListener("hashchange", dismissUI);
window.addEventListener("popstate", dismissUI);

async function translateSelection() {
  const selection = window.getSelection();
  const selectedText = getSelectionText();

  if (!selection || selection.rangeCount === 0 || !selectedText) {
    return;
  }

  if (overlay && selectedText === lastSelectionText) {
    return;
  }

  const range = selection.getRangeAt(0);
  const geometry = getSelectionGeometry(range);

  if (!geometry) {
    return;
  }

  const text = cleanSelectionText(selectedText, range);
  if (!text) {
    return;
  }

  lastSelectionText = selectedText;
  const currentRequestId = ++requestId;

  showOverlay(range, "Translating...", "loading");

  try {
    const targetLanguage = await getTargetLanguage();
    const result = await translationService.translate({
      text,
      targetLanguage,
      onProgress(progress) {
        if (currentRequestId === requestId && progress?.message) {
          updateOverlay(progress.message, "loading");
        }
      }
    });

    if (currentRequestId === requestId) {
      updateOverlay(result.text, "ready");
      repositionOverlay();
    }
  } catch (error) {
    if (currentRequestId === requestId) {
      updateOverlay(readableError(error), "error");
    }
  }
}

function getSelectionText() {
  return window.getSelection()?.toString().trim() || "";
}

function cleanSelectionText(text, range) {
  let cleaned = text.trim();

  if (startsInsideWord(cleaned, range)) {
    cleaned = cleaned.replace(/^\S+\s*/u, "");
  }

  if (endsInsideWord(cleaned, range)) {
    cleaned = cleaned.replace(/\s*\S+$/u, "");
  }

  return cleaned.trim();
}

function startsInsideWord(text, range) {
  const first = firstWordChar(text);
  const before = getTextBeforeBoundary(range.startContainer, range.startOffset);
  return Boolean(first && before && isWordChar(first) && isWordChar(before));
}

function endsInsideWord(text, range) {
  const last = lastWordChar(text);
  const after = getTextAfterBoundary(range.endContainer, range.endOffset);
  return Boolean(last && after && isWordChar(last) && isWordChar(after));
}

function firstWordChar(text) {
  return Array.from(text).find((char) => isWordChar(char)) || "";
}

function lastWordChar(text) {
  return Array.from(text).reverse().find((char) => isWordChar(char)) || "";
}

function isWordChar(char) {
  return /[\p{L}\p{N}]/u.test(char);
}

function getTextBeforeBoundary(container, offset) {
  if (container.nodeType === Node.TEXT_NODE) {
    if (offset > 0) {
      return container.data.at(offset - 1) || "";
    }
  }

  if (container.nodeType === Node.ELEMENT_NODE) {
    const child = container.childNodes[offset - 1];
    const char = getLastTextChar(child);
    if (char) {
      return char;
    }
  }

  return getTextCharAroundBoundary(container, offset, "before");
}

function getTextAfterBoundary(container, offset) {
  if (container.nodeType === Node.TEXT_NODE) {
    if (offset < container.data.length) {
      return container.data.at(offset) || "";
    }
  }

  if (container.nodeType === Node.ELEMENT_NODE) {
    const child = container.childNodes[offset];
    const char = getFirstTextChar(child);
    if (char) {
      return char;
    }
  }

  return getTextCharAroundBoundary(container, offset, "after");
}

function getLastTextChar(node) {
  if (!node) {
    return "";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.data.at(-1) || "";
  }

  for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
    const char = getLastTextChar(node.childNodes[index]);
    if (char) {
      return char;
    }
  }

  return "";
}

function getFirstTextChar(node) {
  if (!node) {
    return "";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.data.at(0) || "";
  }

  for (const child of node.childNodes) {
    const char = getFirstTextChar(child);
    if (char) {
      return char;
    }
  }

  return "";
}

function getTextCharAroundBoundary(container, offset, direction) {
  const boundary = document.createRange();
  boundary.setStart(container, offset);
  boundary.collapse(true);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let before = "";

  while (walker.nextNode()) {
    const textNode = walker.currentNode;

    if (direction === "before" && boundary.comparePoint(textNode, textNode.length) <= 0) {
      before = getLastTextChar(textNode) || before;
      continue;
    }

    if (direction === "after" && boundary.comparePoint(textNode, 0) >= 0) {
      return getFirstTextChar(textNode);
    }

    if (direction === "before") {
      return before;
    }
  }

  return direction === "before" ? before : "";
}

function showOverlay(range, text, state) {
  overlay?.remove();
  overlay = null;

  const geometry = getSelectionGeometry(range);
  if (!geometry) {
    return;
  }

  overlay = document.createElement("div");
  overlay.className = "selection-translator-overlay";
  overlay.textContent = text;
  overlay.dataset.state = state;
  overlay.dataset.multiline = geometry.isMultiLine ? "true" : "false";

  copyTextStyles(overlay, range);
  document.documentElement.append(overlay);
  placeOverlay(overlay, geometry);
}

function updateOverlay(text, state) {
  if (!overlay) {
    return;
  }

  overlay.textContent = text;
  overlay.dataset.state = state;
}

function removeOverlay(options = {}) {
  overlay?.remove();
  overlay = null;

  if (options.cancelRequest !== false) {
    requestId += 1;
  }

  if (!options.keepSelectionText) {
    lastSelectionText = "";
  }
}

function dismissUI() {
  removeOverlay();
}

function repositionOverlay() {
  if (!overlay) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !getSelectionText()) {
    removeOverlay();
    return;
  }

  const range = selection.getRangeAt(0);
  placeOverlay(overlay, getSelectionGeometry(range));
}

function getSelectionGeometry(range) {
  const rects = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .sort((a, b) => {
      if (Math.abs(a.top - b.top) > 2) {
        return a.top - b.top;
      }

      return a.left - b.left;
    });

  if (rects.length === 0) {
    const fallback = range.getBoundingClientRect();
    if (fallback.width <= 0 || fallback.height <= 0) {
      return null;
    }

    rects.push(fallback);
  }

  const bounds = rects.reduce(
    (acc, rect) => {
      acc.top = Math.min(acc.top, rect.top);
      acc.right = Math.max(acc.right, rect.right);
      acc.bottom = Math.max(acc.bottom, rect.bottom);
      acc.left = Math.min(acc.left, rect.left);
      return acc;
    },
    {
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
      left: Number.POSITIVE_INFINITY
    }
  );

  return {
    firstRect: rects[0],
    bounds: {
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      left: bounds.left,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top
    },
    lineCount: rects.length,
    isMultiLine: rects.length > 1
  };
}

function placeOverlay(element, geometry) {
  if (!geometry) {
    removeOverlay();
    return;
  }

  const viewportPadding = 8;
  const anchor = geometry.firstRect;
  const bounds = geometry.bounds;
  const textLength = element.textContent.length;
  const maxWidth = Math.min(920, Math.max(120, window.innerWidth - viewportPadding * 2));
  const readableWidth = textLength > 280 ? 860 : textLength > 120 ? 680 : textLength > 48 ? 460 : 0;
  const preferredWidth = Math.max(geometry.isMultiLine ? bounds.width : anchor.width, readableWidth);
  const width = Math.min(Math.max(preferredWidth, 96), maxWidth);
  const left = clamp(
    (geometry.isMultiLine ? bounds.left : anchor.left) + window.scrollX,
    window.scrollX + viewportPadding,
    window.scrollX + window.innerWidth - width - viewportPadding
  );
  const top = Math.max(bounds.top + window.scrollY - 1, window.scrollY + viewportPadding);

  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;
  element.style.width = `${Math.round(width)}px`;
  element.style.minHeight = `${Math.max(18, Math.round(anchor.height))}px`;

  if (geometry.isMultiLine || textLength > 280) {
    element.dataset.long = textLength > 280 ? "true" : "false";
  } else {
    delete element.dataset.long;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function copyTextStyles(element, range) {
  const node = range.startContainer;
  const source = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

  if (!source) {
    return;
  }

  const styles = getComputedStyle(source);
  element.style.font = styles.font;
  element.style.lineHeight = styles.lineHeight;
  element.style.letterSpacing = styles.letterSpacing;
  element.style.direction = styles.direction;
  element.style.textAlign = styles.textAlign;
}

async function getTargetLanguage() {
  const { targetLanguage } = await chrome.storage.sync.get({
    targetLanguage: ""
  });

  return SelectionTranslator.normalizeLanguage(
    targetLanguage || chrome.i18n?.getUILanguage?.() || navigator.language || DEFAULT_TARGET_LANGUAGE
  );
}

function readableError(error) {
  console.debug("Scribe:", error);
  if (error instanceof SelectionTranslator.TranslationUnavailableError) {
    return "Translation is not available in this browser yet.";
  }

  return "Could not translate this selection.";
}
})();
