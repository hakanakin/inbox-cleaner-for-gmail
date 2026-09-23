export const DEFAULT_SETTINGS = Object.freeze({
  language: "auto",
  scanLimit: 200,
  reviewDays: 30,
  keepSenders: [],
  cleanPromotions: true,
  cleanSocial: true,
});

const SUPPORTED_LANGUAGES = new Set(["auto", "en", "es", "zh_CN", "hi", "ar", "tr"]);
const MAX_SAFE_SCAN_LIMIT = 250;
const SCAN_STATE_KEY = "lastScanStateV1";
const SCAN_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function normalizeSenders(senders) {
  if (!Array.isArray(senders)) return [];
  return [...new Set(senders.map((sender) => String(sender).trim()).filter(Boolean))];
}

export function normalizeSettings(settings = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  return {
    language: SUPPORTED_LANGUAGES.has(merged.language) ? merged.language : "auto",
    scanLimit: clampInteger(merged.scanLimit, DEFAULT_SETTINGS.scanLimit, 1, MAX_SAFE_SCAN_LIMIT),
    reviewDays: clampInteger(merged.reviewDays, DEFAULT_SETTINGS.reviewDays, 1, 3650),
    keepSenders: normalizeSenders(merged.keepSenders),
    cleanPromotions: Boolean(merged.cleanPromotions),
    cleanSocial: Boolean(merged.cleanSocial),
  };
}

export async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get("settings");
  return normalizeSettings(settings);
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings: normalizeSettings(settings) });
}

export async function getScanState() {
  const stored = await chrome.storage.local.get(SCAN_STATE_KEY);
  const scanState = stored[SCAN_STATE_KEY];
  if (!scanState?.savedAt || Date.now() - scanState.savedAt > SCAN_STATE_MAX_AGE_MS) {
    if (scanState) await chrome.storage.local.remove(SCAN_STATE_KEY);
    return null;
  }
  return scanState;
}

export async function saveScanState(scanState) {
  await chrome.storage.local.set({
    [SCAN_STATE_KEY]: { ...scanState, savedAt: Date.now() },
  });
}

export async function clearScanState() {
  await chrome.storage.local.remove(SCAN_STATE_KEY);
}
