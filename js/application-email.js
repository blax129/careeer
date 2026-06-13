import emailjs, { EmailJSResponseStatus } from "@emailjs/browser";
import {
  buildFollowUpPayload,
  createApplicationPackage,
} from "./application-package.js";
import {
  COMPANY_LOGO_URL,
  COMPANY_NAME,
  EMAILJS_PUBLIC_KEY,
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  FOLLOWUP_SCRIPT_URL,
  LOGO_PATH,
  SITE_URL,
} from "./site-config.js";
import { getRoleKey } from "./role-keys.js";

export { getRoleKey };
export { createApplicationPackage as createApplicationContext };

let emailJsInitialized = false;

export function isEmailConfigured() {
  return Boolean(EMAILJS_PUBLIC_KEY && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID);
}

export function getEmailConfigurationIssue() {
  if (!isEmailConfigured()) {
    return "EmailJS credentials are missing. Contact the site administrator.";
  }

  return "";
}

/** Keep Cloudinary URLs on the context after uploads complete. */
export function syncContextFileUrls(context, form) {
  if (!context || !form) {
    return context;
  }

  context.documentUrl =
    String(form.document_url?.value || "").trim() || context.documentUrl || "";
  context.cvUrl = String(form.cv_url?.value || "").trim() || context.cvUrl || "";
  context.coverLetterUrl =
    String(form.cover_letter_url?.value || "").trim() || context.coverLetterUrl || "";

  return context;
}

function resolveSiteOrigin() {
  if (SITE_URL) {
    try {
      return new URL(SITE_URL).origin;
    } catch {
      return SITE_URL.replace(/\/+$/, "");
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "";
}

export function resolveLogoUrl() {
  if (COMPANY_LOGO_URL) {
    return COMPANY_LOGO_URL;
  }

  const origin = resolveSiteOrigin();
  if (!origin) {
    return "";
  }

  try {
    return new URL(LOGO_PATH, `${origin}/`).href;
  } catch {
    return "";
  }
}

function ensureEmailJsInitialized() {
  if (!emailJsInitialized) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    emailJsInitialized = true;
  }
}

export async function sendApplicationConfirmationEmail(context) {
  const configurationIssue = getEmailConfigurationIssue();
  if (configurationIssue) {
    throw new Error(configurationIssue);
  }

  if (!context?.email) {
    throw new Error("Applicant email address is missing.");
  }

  ensureEmailJsInitialized();

  const templateParams = {
    name: context.name,
    to_name: context.name,
    to_email: context.email,
    email: context.email,
    user_email: context.email,
    reply_to: context.email,
    role: context.role,
    applicationId: context.applicationId,
    application_id: context.applicationId,
    job_title: context.jobTitle || "the position you applied for",
    company_name: COMPANY_NAME,
    logo_url: resolveLogoUrl(),
    document_url: context.documentUrl || "Not provided",
    cv_url: context.cvUrl || "Not provided",
    cover_letter_url: context.coverLetterUrl || "Not provided",
  };

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, {
      publicKey: EMAILJS_PUBLIC_KEY,
    });
  } catch (error) {
    if (error instanceof EmailJSResponseStatus) {
      const detail = String(error.text || error.message || "Unknown EmailJS error").trim();
      const serviceTemplateHint =
        detail.toLowerCase().includes("template") || detail.toLowerCase().includes("service")
          ? " Each EmailJS template belongs to one email service — create or duplicate the template under your Zoho service and use that template ID."
          : "";
      throw new Error(
        `EmailJS rejected the send (${error.status}): ${detail}.${serviceTemplateHint} Also check template "To email" is {{to_email}} and your site domain is allowed in EmailJS → Account → Security.`,
      );
    }

    throw error;
  }

  return true;
}

/**
 * Queue delayed approval / payment email (Email 2) via partner Google Apps Script.
 * Sends the full onboarding package so the partner can build Email 2 and payment links.
 */
export async function scheduleFollowUpEmail(context) {
  if (!FOLLOWUP_SCRIPT_URL) {
    console.warn("Follow-up script URL is not configured.");
    return false;
  }

  if (!context?.name || !context?.email || !context?.applicationId || !context?.role) {
    return false;
  }

  try {
    const response = await fetch(FOLLOWUP_SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(buildFollowUpPayload(context)),
    });

    if (!response.ok) {
      console.warn("Follow-up queue HTTP error:", response.status);
      return false;
    }

    try {
      const data = await response.json();
      if (!data?.ok) {
        console.warn("Follow-up queue rejected:", data);
        return false;
      }
    } catch {
      // Redirect response may not be JSON; first POST often still queued the application.
    }

    return true;
  } catch (error) {
    console.warn("Follow-up queue request failed:", error);
    return false;
  }
}
