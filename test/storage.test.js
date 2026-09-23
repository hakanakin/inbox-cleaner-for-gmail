import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SETTINGS, normalizeSettings } from "../src/storage.js";

test("settings use safe defaults", () => {
  assert.deepEqual(normalizeSettings(), DEFAULT_SETTINGS);
});

test("settings clamp numeric values and reject unsupported languages", () => {
  const settings = normalizeSettings({
    language: "xx",
    scanLimit: 9999,
    reviewDays: 0,
  });

  assert.equal(settings.language, "auto");
  assert.equal(settings.scanLimit, 250);
  assert.equal(settings.reviewDays, 1);
});

test("trusted senders are trimmed, deduplicated, and validated", () => {
  const settings = normalizeSettings({
    keepSenders: [" billing@example.com ", "", "billing@example.com"],
    cleanPromotions: 0,
    cleanSocial: 1,
  });

  assert.deepEqual(settings.keepSenders, ["billing@example.com"]);
  assert.equal(settings.cleanPromotions, false);
  assert.equal(settings.cleanSocial, true);
});
