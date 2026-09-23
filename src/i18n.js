const SUPPORTED_LOCALES = new Set(["en", "es", "zh_CN", "hi", "ar", "tr"]);
let activeLocale = "en";
let messages = {};

function resolveLocale(preferredLocale = "auto") {
  if (preferredLocale !== "auto" && SUPPORTED_LOCALES.has(preferredLocale)) {
    return preferredLocale;
  }

  const browserLocale = (chrome.i18n.getUILanguage() || "en").replace("_", "-").toLowerCase();
  if (browserLocale.startsWith("zh")) return "zh_CN";

  const language = browserLocale.split("-")[0];
  return SUPPORTED_LOCALES.has(language) ? language : "en";
}

export function t(key, values = {}) {
  const template = messages[key]?.message || key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
  ));
}

export function localizeDocument(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  ["title", "aria-label", "placeholder"].forEach((attribute) => {
    const dataAttribute = "data-i18n-" + attribute;
    root.querySelectorAll("[" + dataAttribute + "]").forEach((element) => {
      element.setAttribute(attribute, t(element.getAttribute(dataAttribute)));
    });
  });
}

export async function initI18n(preferredLocale = "auto") {
  activeLocale = resolveLocale(preferredLocale);

  try {
    const response = await fetch(chrome.runtime.getURL("_locales/" + activeLocale + "/messages.json"));
    if (!response.ok) throw new Error("Locale could not be loaded");
    messages = await response.json();
  } catch {
    activeLocale = "en";
    const response = await fetch(chrome.runtime.getURL("_locales/en/messages.json"));
    messages = await response.json();
  }

  document.documentElement.lang = activeLocale === "zh_CN" ? "zh-CN" : activeLocale;
  document.documentElement.dir = activeLocale === "ar" ? "rtl" : "ltr";
  localizeDocument();
  return activeLocale;
}

export function getActiveLocale() {
  return activeLocale;
}
