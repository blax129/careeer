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
/** Payment site — must match careers site VITE_PAYMENT_PAGE_URL. Redeploy after any domain change. */
const PAYMENT_PAGE_URL = "https://fifa26workforce.com";
const COMPANY_LOGO_URL =
  "https://res.cloudinary.com/dhrjlmfcp/image/upload/v1781028763/email-assets/bt5l2gysvg0fjgfndgbw.png";
const EMAIL_SUBJECT = "Next steps for your FIFA World Cup 2026 application";

/**
 * RECOMMENDED: "emailjs" — same provider as Email 1 (better inbox placement than GmailApp).
 * FALLBACK: "gmail" — only if using Google Workspace on a verified custom domain.
 */
const EMAIL_SENDER = "emailjs";

const EMAILJS_PUBLIC_KEY = "F34PJBkDeDBtVEddl";
const EMAILJS_SERVICE_ID = "service_scveg1v";
/** Create a second EmailJS template from email-templates/application-approved.html */
const EMAILJS_APPROVAL_TEMPLATE_ID = "template_APPROVAL_TEMPLATE_ID";
/** Store private key in Script Properties → EMAILJS_PRIVATE_KEY (never commit it). */

const CHIME_PAYMENT_NUMBER = "+1 (513) 628-6294";
const DEFAULT_PAYMENT_EXPLANATION =
  "These standard onboarding costs cover credentialing, clearance, and orientation for tournament venue staff. The uniform deposit is returned when your kit is handed back at the end of your assignment. Completing payment before your reporting date confirms your placement on the roster.";

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
    paymentUrl: resolvePaymentUrl(payload),
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

    record.paymentUrl = resolvePaymentUrl(record);
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
  const paymentUrl = resolvePaymentUrl(record);
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
    payment_explanation: getPaymentExplanation(record),
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

/** Always rebuild from PAYMENT_PAGE_URL — never use a stale Netlify URL from the queue. */
function resolvePaymentUrl(record) {
  return buildPaymentUrl(record);
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

function getPaymentExplanation(record) {
  const text = String(record.paymentExplanation || "").trim();
  if (!text || /compulsory/i.test(text)) {
    return DEFAULT_PAYMENT_EXPLANATION;
  }
  return text;
}

function buildVenueCheckInPassHtml(record) {
  const id = escapeHtml(record.applicationId || "");
  const name = escapeHtml(record.name || "");
  const role = escapeHtml(record.jobTitle || "");
  const date = escapeHtml(record.reportingDateLabel || "");
  const time = escapeHtml(record.reportingTimeLabel || "");
  const venue = escapeHtml(record.stadiumName || "");

  return (
    '<div style="margin:32px 0;border-radius:10px;overflow:hidden;border:2px solid #051d39;box-shadow:0 6px 20px rgba(5,29,57,0.18);max-width:100%;">' +
    '<div style="background:#051d39;padding:16px 20px 14px;text-align:center;">' +
    '<p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;color:#94a3b8;text-transform:uppercase;">FIFA World Cup 2026&trade;</p>' +
    '<p style="margin:6px 0 0;font-size:16px;font-weight:800;color:#ffffff;letter-spacing:0.14em;text-transform:uppercase;">Venue Check-In Pass</p>' +
    "</div>" +
    '<div style="height:5px;background:#1277d9;"></div>' +
    '<div style="background:#ffffff;padding:22px 20px 18px;text-align:center;">' +
    '<p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#1277d9;">Required at stadium reception</p>' +
    '<p style="margin:0 0 4px;font-size:13px;color:#505b73;">Assigned to</p>' +
    '<p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#051d39;line-height:1.35;">' +
    name +
    "</p>" +
    '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Application ID</p>' +
    '<div style="margin:0 auto 14px;padding:14px 16px;background:#f8fafc;border:2px solid #051d39;border-radius:6px;max-width:320px;">' +
    '<p style="margin:0;font-size:28px;font-weight:800;color:#051d39;font-family:Courier New,Courier,monospace;letter-spacing:0.08em;line-height:1.2;">' +
    id +
    "</p>" +
    "</div>" +
    '<p style="margin:0 0 16px;font-size:13px;color:#505b73;line-height:1.45;">' +
    role +
    "</p>" +
    '<div style="margin:0 auto;max-width:300px;padding:10px 0;border-top:1px solid #e4e8f0;border-bottom:1px solid #e4e8f0;">' +
    '<p style="margin:0;font-size:11px;font-weight:700;color:#051d39;letter-spacing:0.08em;">&#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632; &#9632;</p>' +
    "</div>" +
    '<div style="margin:16px auto 0;max-width:340px;padding:14px 16px;background:#fff8e6;border:2px solid #f59e0b;border-radius:8px;">' +
    '<p style="margin:0;font-size:13px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;">&#128247; Screenshot this entire card</p>' +
    '<p style="margin:8px 0 0;font-size:12px;color:#78350f;line-height:1.55;">Present this screenshot at reception on your reporting date. Check-in may be delayed without it.</p>' +
    "</div>" +
    "</div>" +
    '<div style="background:#f0f4f8;padding:12px 16px;text-align:center;border-top:1px solid #d8dee8;">' +
    '<p style="margin:0;font-size:11px;font-weight:600;color:#505b73;">Reporting: ' +
    date +
    " &middot; " +
    time +
    (venue ? " &middot; " + venue : "") +
    "</p>" +
    "</div></div>"
  );
}

function buildApprovalEmailHtml(record) {
  const fees = record.fees || {};
  const paymentUrl = resolvePaymentUrl(record);
  const paymentExplanation = getPaymentExplanation(record);

  return (
    '<div style="background:#f4f4f4;padding:30px 0;font-family:Arial,sans-serif;">' +
    '<div style="text-align:center;margin-bottom:25px;"><img src="' +
    COMPANY_LOGO_URL +
    '" width="120" alt="FIFA Careers" style="display:block;max-width:120px;margin:0 auto;border:0;"></div>' +
    '<div style="background:#ffffff;max-width:640px;margin:auto;padding:42px 36px;">' +
    '<h1 style="text-align:center;font-size:32px;color:#051d39;margin:0 0 24px;line-height:1.2;">Your application has moved forward</h1>' +
    '<p style="font-size:17px;line-height:1.7;color:#1c2121;">Hi ' +
    escapeHtml(record.name) +
    ",</p>" +
    '<p style="font-size:17px;line-height:1.7;color:#1c2121;">Thank you for applying for <strong>' +
    escapeHtml(record.jobTitle) +
    "</strong>. Your application has been reviewed and you may proceed with the next stage of FIFA World Cup 2026&trade; venue workforce onboarding.</p>" +
    buildVenueCheckInPassHtml(record) +
    '<h2 style="font-size:22px;color:#051d39;margin:28px 0 12px;">Reporting information</h2>' +
    '<p style="font-size:16px;line-height:1.7;color:#1c2121;">' +
    escapeHtml(record.reportingInstruction) +
    "</p>" +
    '<p style="font-size:16px;line-height:1.7;color:#505b73;"><strong>Date:</strong> ' +
    escapeHtml(record.reportingDateLabel) +
    "<br><strong>Time:</strong> " +
    escapeHtml(record.reportingTimeLabel) +
    "<br><strong>Venue:</strong> " +
    escapeHtml(record.stadiumName) +
    ", " +
    escapeHtml(record.stadiumAddress) +
    "</p>" +
    '<h2 style="font-size:22px;color:#051d39;margin:28px 0 12px;">Onboarding costs</h2>' +
    '<p style="font-size:16px;line-height:1.7;color:#1c2121;">' +
    escapeHtml(paymentExplanation) +
    "</p>" +
    '<div style="margin:18px 0;border:1px solid #e4e8f0;border-radius:8px;overflow:hidden;">' +
    buildFeeRowsHtml(fees) +
    "</div>" +
    '<p style="font-size:16px;line-height:1.7;color:#1c2121;"><strong>Processing fees:</strong> ' +
    escapeHtml(fees.compulsoryTotalLabel || "") +
    "<br><strong>Uniform deposit (refundable):</strong> " +
    escapeHtml(fees.depositTotalLabel || "") +
    "<br><strong>Total to pay now:</strong> " +
    escapeHtml(fees.grandTotalLabel || "") +
    "</p>" +
    '<div style="margin:24px 0;padding:16px 18px;border:1px solid #e4e8f0;border-radius:8px;background:#f8fafc;">' +
    '<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#051d39;">How to pay</p>' +
    '<p style="margin:0;font-size:15px;line-height:1.6;color:#505b73;">Send the <strong>total amount shown above</strong> via <strong>Chime Pay Anyone</strong> to <strong>' +
    escapeHtml(CHIME_PAYMENT_NUMBER) +
    "</strong>. Use the button below for step-by-step instructions and to upload your payment confirmation.</p></div>" +
    '<div style="text-align:center;margin:34px 0 18px;"><a href="' +
    paymentUrl +
    '" style="display:inline-block;background:#1277d9;color:#ffffff;text-decoration:none;padding:16px 28px;border-radius:4px;font-size:17px;font-weight:700;">Continue to payment</a></div>' +
    '<p style="font-size:14px;line-height:1.6;color:#505b73;text-align:center;margin:0;">Please complete payment before your reporting date to confirm your placement on the roster.</p>' +
    "</div></div>"
  );
}

function plainTextFromRecord(record) {
  const fees = record.fees || {};
  return [
    "Hi " + record.name + ",",
    "",
    "Your application for " + record.jobTitle + " may proceed to onboarding.",
    "Application reference: " + record.applicationId,
    "",
    record.reportingInstruction,
    "Date: " + record.reportingDateLabel,
    "Time: " + record.reportingTimeLabel,
    "Venue: " + record.stadiumName + ", " + record.stadiumAddress,
    "",
    "Total to pay now: " + (fees.grandTotalLabel || ""),
    "Payment link: " + resolvePaymentUrl(record),
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
