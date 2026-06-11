/**
 * Google Apps Script — shared position counters for all site visitors.
 *
 * Setup:
 * 1. Go to https://script.google.com and create a new project
 * 2. Paste this file into Code.gs
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the web app URL into .env as VITE_SLOTS_API_URL=
 * 5. Run: npm run build
 */

function doGet(event) {
  const props = PropertiesService.getScriptProperties();

  if (event.parameter.all === "1") {
    return jsonResponse(props.getProperties());
  }

  const jobId = String(event.parameter.jobId || "");
  if (!jobId) {
    return jsonResponse({ error: "jobId is required" });
  }

  return jsonResponse({ filled: readFilled(props, jobId) });
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const jobId = String(payload.jobId || "");

  if (!jobId) {
    return jsonResponse({ error: "jobId is required" });
  }

  const props = PropertiesService.getScriptProperties();
  const filled = readFilled(props, jobId) + 1;
  props.setProperty(jobId, String(filled));

  return jsonResponse({ filled });
}

function readFilled(props, jobId) {
  return Number(props.getProperty(jobId) || 0);
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
