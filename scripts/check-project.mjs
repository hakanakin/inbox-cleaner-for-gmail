import { readdir, readFile } from "node:fs/promises";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function difference(left, right) {
  const rightValues = new Set(right);
  return left.filter((value) => !rightValues.has(value));
}

const localeDirectories = await readdir("_locales");
const localePaths = localeDirectories.map((locale) => `_locales/${locale}/messages.json`);
const jsonPaths = ["manifest.json", "package.json", ...localePaths];
const parsedJson = new Map();

for (const path of jsonPaths) {
  parsedJson.set(path, await readJson(path));
}

const manifest = parsedJson.get("manifest.json");
const packageJson = parsedJson.get("package.json");
if (manifest.version !== packageJson.version) {
  throw new Error(`Version mismatch: manifest=${manifest.version}, package=${packageJson.version}`);
}

const englishKeys = Object.keys(parsedJson.get("_locales/en/messages.json"));
for (const path of localePaths) {
  const keys = Object.keys(parsedJson.get(path));
  const missing = difference(englishKeys, keys);
  const extra = difference(keys, englishKeys);
  if (missing.length || extra.length) {
    throw new Error(`${path} has inconsistent keys. Missing: ${missing}. Extra: ${extra}.`);
  }
}

const popupSource = await readFile("popup.js", "utf8");
const popupMarkup = await readFile("popup.html", "utf8");
const referencedIds = [...popupSource.matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]);
const markupIds = new Set(
  [...popupMarkup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
);
const missingIds = [...new Set(referencedIds)].filter((id) => !markupIds.has(id));
if (missingIds.length) {
  throw new Error(`popup.js references missing element IDs: ${missingIds.join(", ")}`);
}

console.log(
  `Validated ${jsonPaths.length} JSON files, ${localePaths.length} locales, and ${new Set(referencedIds).size} popup elements.`,
);
