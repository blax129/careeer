/**
 * Post-build check — production bundles must use the live Formspree form ID.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FORM_ID = "mdavpbew";
const OLD_FORM_ID = "mvznkvzv";
const assetsDir = join(import.meta.dirname, "..", "dist", "assets");

let bundleText = "";

for (const file of readdirSync(assetsDir)) {
  if (!file.endsWith(".js")) continue;
  bundleText += readFileSync(join(assetsDir, file), "utf8");
}

if (!bundleText.includes(`formspree.io/f/${FORM_ID}`)) {
  console.error(`Formspree build check FAILED: expected formspree.io/f/${FORM_ID} in dist/assets`);
  process.exit(1);
}

if (bundleText.includes(`formspree.io/f/${OLD_FORM_ID}`)) {
  console.error(`Formspree build check FAILED: old form ${OLD_FORM_ID} still in dist/assets`);
  process.exit(1);
}

console.log(`Formspree build OK: ${FORM_ID}`);
