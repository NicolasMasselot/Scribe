(() => {
  const DEFAULT_SOURCE_LANGUAGE = "en";
  const DEFAULT_TARGET_LANGUAGE = "en";

  class TranslationUnavailableError extends Error {
    constructor(message = "Translation unavailable") {
      super(message);
      this.name = "TranslationUnavailableError";
    }
  }

  class ChromeLocalTranslatorProvider {
    constructor() {
      this.id = "chrome-local";
      this.label = "Chrome local Translator API";
      this.translators = new Map();
    }

    isSupported() {
      return "Translator" in self;
    }

    async translate({ text, targetLanguage, onProgress }) {
      if (!this.isSupported()) {
        throw new TranslationUnavailableError("Translation unavailable: Chrome local Translator API is not supported.");
      }

      const sourceLanguage = await detectSourceLanguage(text);
      const normalizedTarget = normalizeLanguage(targetLanguage);

      if (sourceLanguage === normalizedTarget) {
        return {
          providerId: this.id,
          sourceLanguage,
          targetLanguage: normalizedTarget,
          text
        };
      }

      const availability = await Translator.availability({
        sourceLanguage,
        targetLanguage: normalizedTarget
      });

      if (availability === "unavailable") {
        throw new TranslationUnavailableError(
          `Translation unavailable: ${sourceLanguage} to ${normalizedTarget} is not supported locally.`
        );
      }

      const translator = await this.getTranslator(sourceLanguage, normalizedTarget, onProgress);
      const translatedText = await translator.translate(text);

      return {
        providerId: this.id,
        sourceLanguage,
        targetLanguage: normalizedTarget,
        text: translatedText
      };
    }

    async getTranslator(sourceLanguage, targetLanguage, onProgress) {
      const cacheKey = `${sourceLanguage}:${targetLanguage}`;
      let translator = this.translators.get(cacheKey);

      if (translator) {
        return translator;
      }

      translator = await Translator.create({
        sourceLanguage,
        targetLanguage,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            onProgress?.({
              type: "download",
              loaded: event.loaded,
              message: `Downloading language pack ${Math.round(event.loaded * 100)}%...`
            });
          });
        }
      });

      this.translators.set(cacheKey, translator);
      return translator;
    }
  }

  class UnavailableTranslatorProvider {
    constructor() {
      this.id = "unavailable";
      this.label = "Unavailable fallback";
    }

    isSupported() {
      return true;
    }

    async translate() {
      throw new TranslationUnavailableError(
        "Translation unavailable: no local translation provider is supported in this browser."
      );
    }
  }

  class TranslationService {
    constructor(providers) {
      this.providers = providers;
    }

    getPrimaryProvider() {
      return this.providers.find((provider) => provider.isSupported()) || new UnavailableTranslatorProvider();
    }

    async translate({ text, targetLanguage, onProgress }) {
      const provider = this.getPrimaryProvider();
      return provider.translate({
        text,
        targetLanguage,
        onProgress
      });
    }
  }

  async function detectSourceLanguage(text) {
    if (!("LanguageDetector" in self)) {
      return DEFAULT_SOURCE_LANGUAGE;
    }

    const availability = await LanguageDetector.availability();
    if (availability === "unavailable") {
      return DEFAULT_SOURCE_LANGUAGE;
    }

    const detector = await LanguageDetector.create();
    const results = await detector.detect(text);
    return normalizeLanguage(results?.[0]?.detectedLanguage || DEFAULT_SOURCE_LANGUAGE);
  }

  function normalizeLanguage(language) {
    const value = String(language || DEFAULT_TARGET_LANGUAGE).trim();

    if (/^zh-hant$/i.test(value)) {
      return "zh-Hant";
    }

    return value.split("-")[0].toLowerCase();
  }

  self.SelectionTranslator = Object.freeze({
    TranslationService,
    TranslationUnavailableError,
    providers: Object.freeze({
      ChromeLocalTranslatorProvider,
      UnavailableTranslatorProvider
    }),
    normalizeLanguage
  });
})();
