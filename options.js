import { getSettings, saveSettings } from "./src/storage.js";
import { initI18n } from "./src/i18n.js";

const ids = ["language", "scanLimit", "reviewDays", "cleanPromotions", "cleanSocial", "keepSenders"];
const fields = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const settings = await getSettings();
await initI18n(settings.language);

for (const id of ids) {
  if (fields[id].type === "checkbox") {
    fields[id].checked = settings[id];
  } else {
    fields[id].value = Array.isArray(settings[id])
      ? settings[id].join("\n")
      : settings[id];
  }
}

fields.language.addEventListener("change", async () => {
  await initI18n(fields.language.value);
});

document.getElementById("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings({
    language: fields.language.value,
    scanLimit: Number(fields.scanLimit.value),
    reviewDays: Number(fields.reviewDays.value),
    cleanPromotions: fields.cleanPromotions.checked,
    cleanSocial: fields.cleanSocial.checked,
    keepSenders: fields.keepSenders.value
      .split("\n")
      .map((sender) => sender.trim())
      .filter(Boolean),
  });

  const saved = document.getElementById("saved");
  saved.hidden = false;
  setTimeout(() => {
    saved.hidden = true;
  }, 2400);
});
