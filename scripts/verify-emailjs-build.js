/**
 * Post-build check — ensures production JS contains the live EmailJS pair.
 * Run automatically after `npm run build`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SERVICE_ID = "service_scveg1v";
const TEMPLATE_ID = "template_jwpyyg2";
const assetsDir = join(import.meta.dirname, "..", "dist", "assets");

let bundleText = "";

for (const file of readdirSync(assetsDir)) {
  if (!file.endsWith(".js")) continue;
  bundleText += readFileSync(join(assetsDir, file), "utf8");
}

const hasService = bundleText.includes(SERVICE_ID);
const hasTemplate = bundleText.includes(TEMPLATE_ID);
const hasOldService = bundleText.includes("service_7s6hkrw");
const hasOldTemplate = bundleText.includes("template_x50eqr7");

if (!hasService || !hasTemplate) {
  console.error("EmailJS build check FAILED: expected IDs not found in dist/");
  process.exit(1);
}

if (hasOldService || hasOldTemplate) {
  console.error("EmailJS build check FAILED: old service/template IDs still in dist/");
  process.exit(1);
}

console.log(`EmailJS build OK: ${SERVICE_ID} + ${TEMPLATE_ID}`);
