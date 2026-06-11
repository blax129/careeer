/**
 * Google Apps Script — Email 2 (approval + payment) ~4 hours after application.
 *
 * The careers site POSTs a full onboarding package after EmailJS succeeds.
 * This script stores it, then sends the approval email with payment link.
 *
 * Setup:
 * 1. Create Apps Script project → paste this file into Code.gs
 * 2. Set PAYMENT_PAGE_URL and COMPANY_LOGO_URL below
 * 3. Deploy → Web app (Execute as: Me, Access: Anyone)
 * 4. Add deployment URL to careers site .env as VITE_FOLLOWUP_SCRIPT_URL
 * 5. Add time-driven trigger: sendDueFollowUpEmails → every hour
 */

const FOLLOWUP_DELAY_MS = 4 * 60 * 60 * 1000;
const QUEUE_PREFIX = "followup_";
const PAYMENT_PAGE_URL = "https://imaginative-bonbon-f200da.netlify.app";
const COMPANY_LOGO_URL =
  "https://res.cloudinary.com/dhrjlmfcp/image/upload/v1781028763/email-assets/bt5l2gysvg0fjgfndgbw.png";
const EMAIL_SUBJECT = "Next steps for your FIFA World Cup 2026 application";

/**
 * RECOMMENDED: "emailjs" — same provider as Email 1 (better inbox placement than GmailApp).
 * FALLBACK: "gmail" — only if using Google Workspace on a verified custom domain.
 */
const EMAIL_SENDER = "emailjs";

const EMAILJS_PUBLIC_KEY = "F34PJBkDeDBtVEddl";
const EMAILJS_SERVICE_ID = "service_7s6hkrw";
/** Create a second EmailJS template from email-templates/application-approved.html */
const EMAILJS_APPROVAL_TEMPLATE_ID = "template_APPROVAL_TEMPLATE_ID";
/** Store private key in Script Properties → EMAILJS_PRIVATE_KEY (never commit it). */

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const applicationId = String(payload.applicationId || "");

  if (!applicationId || !payload.email) {
    return jsonResponse({ error: "applicationId and email are required" });
  }

  const record = {
    name: String(payload.name || ""),
    email: String(payload.email || ""),
    role: String(payload.role || ""),
    applicationId,
    jobId: String(payload.jobId || ""),
    jobTitle: String(payload.jobTitle || ""),
    jobLocation: String(payload.jobLocation || ""),
    hostCity: String(payload.hostCity || ""),
    stadiumName: String(payload.stadiumName || ""),
    stadiumAddress: String(payload.stadiumAddress || ""),
    reportingDateLabel: String(payload.reportingDateLabel || ""),
    reportingTimeLabel: String(payload.reportingTimeLabel || ""),
    reportingInstruction: String(payload.reportingInstruction || ""),
    reportingSource: String(payload.reportingSource || ""),
    fees: payload.fees || {},
    paymentExplanation: String(payload.paymentExplanation || ""),
    paymentUrl: String(payload.paymentUrl || buildPaymentUrl(payload)),
    approvedAtIso: String(payload.approvedAtIso || new Date().toISOString()),
    createdAt: new Date().toISOString(),
    sendAt: new Date(Date.now() + FOLLOWUP_DELAY_MS).toISOString(),
    sent: false,
  };

  PropertiesService.getScriptProperties().setProperty(
    QUEUE_PREFIX + applicationId,
    JSON.stringify(record),
  );

  return jsonResponse({ ok: true, applicationId, sendAt: record.sendAt });
}

function sendDueFollowUpEmails() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = Date.now();

  Object.entries(all).forEach(([key, value]) => {
    if (!key.startsWith(QUEUE_PREFIX)) {
      return;
    }

    const record = JSON.parse(value);
    if (record.sent || Date.parse(record.sendAt) > now) {
      return;
    }

    sendFollowUpEmail(record);
    record.sent = true;
    props.setProperty(key, JSON.stringify(record));
  });
}

function sendFollowUpEmail(record) {
  if (EMAIL_SENDER === "emailjs") {
    sendFollowUpEmailViaEmailJS(record);
    return;
  }

  sendFollowUpEmailViaGmail(record);
}

function sendFollowUpEmailViaGmail(record) {
  const html = buildApprovalEmailHtml(record);
  GmailApp.sendEmail(record.email, EMAIL_SUBJECT, plainTextFromRecord(record), {
    htmlBody: html,
    name: "FIFA Careers Recruitment",
    replyTo: getReplyToAddress(),
  });
}

function sendFollowUpEmailViaEmailJS(record) {
  const privateKey =
    PropertiesService.getScriptProperties().getProperty("EMAILJS_PRIVATE_KEY") || "";

  if (!privateKey) {
    throw new Error(
      "EMAILJS_PRIVATE_KEY is missing. Add it in Apps Script → Project Settings → Script properties.",
    );
  }

  const fees = record.fees || {};
  const paymentUrl = record.paymentUrl || buildPaymentUrl(record);
  const html = buildApprovalEmailHtml(record);

  const templateParams = {
    to_email: record.email,
    to_name: record.name,
    name: record.name,
    email: record.email,
    reply_to: record.email,
    subject: EMAIL_SUBJECT,
    job_title: record.jobTitle,
    application_id: record.applicationId,
    applicationId: record.applicationId,
    reporting_instruction: record.reportingInstruction,
    reporting_date: record.reportingDateLabel,
    reporting_time: record.reportingTimeLabel,
    stadium_name: record.stadiumName,
    stadium_address: record.stadiumAddress,
    fee_rows_html: buildFeeRowsHtml(fees),
    compulsory_total: fees.compulsoryTotalLabel || "",
    deposit_total: fees.depositTotalLabel || "",
    grand_total: fees.grandTotalLabel || "",
    payment_explanation: record.paymentExplanation || "",
    payment_url: paymentUrl,
    logo_url: COMPANY_LOGO_URL,
    message_html: html,
  };

  const response = UrlFetchApp.fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_APPROVAL_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: privateKey,
      template_params: templateParams,
    }),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("EmailJS send failed (" + status + "): " + response.getContentText());
  }
}

function getReplyToAddress() {
  try {
    return Session.getActiveUser().getEmail();
  } catch (error) {
    return "";
  }
}

function buildPaymentUrl(record) {
  const payload = {
    applicationId: record.applicationId,
    role: record.role,
    name: record.name,
    email: record.email,
    jobTitle: record.jobTitle,
    jobLocation: record.jobLocation,
    stadiumName: record.stadiumName,
    stadiumAddress: record.stadiumAddress,
    reportingDateLabel: record.reportingDateLabel,
    reportingTimeLabel: record.reportingTimeLabel,
    reportingInstruction: record.reportingInstruction,
    fees: record.fees || {},
    paymentExplanation: record.paymentExplanation || "",
  };

  const encoded = Utilities.base64Encode(JSON.stringify(payload));
  return `${PAYMENT_PAGE_URL.replace(/\/+$/, "")}/?d=${encodeURIComponent(encoded)}`;
}

function buildFeeRowsHtml(fees) {
  const items = (fees && fees.items) || [];
  return items
    .map(function (item) {
      return (
        '<div style="display:flex;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid #e4e8f0;">' +
        '<div><p style="margin:0;font-size:15px;font-weight:700;color:#1c2121;">' +
        escapeHtml(item.label) +
        '</p><p style="margin:4px 0 0;font-size:13px;color:#505b73;">' +
        escapeHtml(item.description) +
        '</p></div><p style="margin:0;font-size:15px;font-weight:700;color:#1c2121;white-space:nowrap;">' +
        escapeHtml(item.amountLabel) +
        "</p></div>"
      );
    })
    .join("");
}

function buildApprovalEmailHtml(record) {
  const fees = record.fees || {};
  const paymentUrl = record.paymentUrl || buildPaymentUrl(record);

  return (
    '<div style="background:#f4f4f4;padding:30px 0;font-family:Arial,sans-serif;">' +
    '<div style="text-align:center;margin-bottom:25px;"><img src="' +
    COMPANY_LOGO_URL +
    '" width="120" alt="FIFA Careers" style="display:block;max-width:120px;margin:0 auto;border:0;"></div>' +
    '<div style="background:#ffffff;max-width:640px;margin:auto;padding:42px 36px;">' +
    '<h1 style="text-align:center;font-size:34px;color:#051d39;margin:0 0 24px;">Congratulations — Your Application Is Approved</h1>' +
    '<p style="font-size:17px;line-height:1.7;">Hi ' +
    escapeHtml(record.name) +
    ",</p>" +
    '<p style="font-size:17px;line-height:1.7;">Your application for <strong>' +
    escapeHtml(record.jobTitle) +
    "</strong> has been approved.</p>" +
    '<div style="margin:28px 0;padding:22px 24px;border:2px dashed #1277d9;border-radius:8px;background:#f5faff;">' +
    '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1277d9;text-transform:uppercase;">Screenshot this section — Application ID</p>' +
    '<p style="margin:0;font-size:30px;font-weight:700;color:#051d39;">' +
    escapeHtml(record.applicationId) +
    "</p></div>" +
    '<h2 style="font-size:22px;color:#051d39;">When to report</h2>' +
    '<p style="font-size:16px;line-height:1.7;">' +
    escapeHtml(record.reportingInstruction) +
    "</p>" +
    '<p style="font-size:16px;line-height:1.7;"><strong>Date:</strong> ' +
    escapeHtml(record.reportingDateLabel) +
    "<br><strong>Time:</strong> " +
    escapeHtml(record.reportingTimeLabel) +
    "<br><strong>Venue:</strong> " +
    escapeHtml(record.stadiumName) +
    ", " +
    escapeHtml(record.stadiumAddress) +
    "</p>" +
    '<h2 style="font-size:22px;color:#051d39;">Compulsory onboarding fees</h2>' +
    '<p style="font-size:16px;line-height:1.7;">' +
    escapeHtml(record.paymentExplanation) +
    "</p>" +
    '<div style="margin:18px 0;border:1px solid #e4e8f0;border-radius:8px;overflow:hidden;">' +
    buildFeeRowsHtml(fees) +
    "</div>" +
    '<p style="font-size:16px;line-height:1.7;"><strong>Compulsory fees:</strong> ' +
    escapeHtml(fees.compulsoryTotalLabel || "") +
    "<br><strong>Uniform deposit:</strong> " +
    escapeHtml(fees.depositTotalLabel || "") +
    "<br><strong>Total due now:</strong> " +
    escapeHtml(fees.grandTotalLabel || "") +
    "</p>" +
    '<div style="text-align:center;margin:34px 0;"><a href="' +
    paymentUrl +
    '" style="display:inline-block;background:#1277d9;color:#ffffff;text-decoration:none;padding:16px 28px;border-radius:4px;font-size:17px;font-weight:700;">I am ready to make this payment</a></div>' +
    "</div></div>"
  );
}

function plainTextFromRecord(record) {
  const fees = record.fees || {};
  return [
    "Congratulations " + record.name + ",",
    "",
    "Your application for " + record.jobTitle + " has been approved.",
    "Application ID: " + record.applicationId,
    "",
    record.reportingInstruction,
    "Date: " + record.reportingDateLabel,
    "Time: " + record.reportingTimeLabel,
    "Venue: " + record.stadiumName + ", " + record.stadiumAddress,
    "",
    "Total due now: " + (fees.grandTotalLabel || ""),
    "Payment link: " + (record.paymentUrl || buildPaymentUrl(record)),
  ].join("\n");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
