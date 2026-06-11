import { formatJobLocation, getWorksiteDisplay } from "./job-filters.js";
import { resolveReportingSchedule } from "./reporting-date.js";
import { getRoleKey } from "./role-keys.js";
import { resolveRoleFees, serializeRoleFees } from "./role-fees.js";
import { PAYMENT_PAGE_URL } from "./site-config.js";
import { encodeBase64Utf8 } from "./text-encoding.js";

function getApplicantName(form) {
  const firstName = form.firstName.value.trim();
  const lastName = form.lastName.value.trim();
  return [firstName, lastName].filter(Boolean).join(" ") || firstName || "Applicant";
}

function splitWorksite(display) {
  if (!display) {
    return { stadiumName: "", stadiumAddress: "" };
  }

  const commaIndex = display.indexOf(",");
  if (commaIndex === -1) {
    return { stadiumName: display.trim(), stadiumAddress: "" };
  }

  return {
    stadiumName: display.slice(0, commaIndex).trim(),
    stadiumAddress: display.slice(commaIndex + 1).trim(),
  };
}

function buildPaymentUrl(context) {
  if (!PAYMENT_PAGE_URL || !context?.applicationId) {
    return "";
  }

  const payload = {
    applicationId: context.applicationId,
    role: context.role,
    name: context.name,
    email: context.email,
    jobTitle: context.jobTitle,
    jobLocation: context.jobLocation,
    stadiumName: context.stadiumName,
    stadiumAddress: context.stadiumAddress,
    reportingDateLabel: context.reportingDateLabel,
    reportingTimeLabel: context.reportingTimeLabel,
    reportingInstruction: context.reportingInstruction,
    fees: context.fees,
  };

  const encoded = encodeURIComponent(encodeBase64Utf8(JSON.stringify(payload)));
  const base = PAYMENT_PAGE_URL.replace(/\/+$/, "");
  return `${base}/?d=${encoded}`;
}

/**
 * Full application context used by EmailJS, Apps Script, and the payment page.
 */
export function createApplicationPackage(form, posting) {
  const location = posting?.location || {};
  const hostCity = String(location.name || location.city || "").trim();
  const worksiteDisplay = getWorksiteDisplay(location) || "";
  const { stadiumName, stadiumAddress } = splitWorksite(worksiteDisplay);
  const role = getRoleKey(posting);
  const fees = resolveRoleFees(posting, role);
  const approvalAt = new Date();

  const reporting = resolveReportingSchedule({
    approvalAt,
    hostCity,
    stadiumName,
    stadiumAddress,
  });

  const context = {
    applicationId: `APP-${Date.now()}`,
    role,
    name: getApplicantName(form),
    email: form.email.value.trim(),
    jobId: String(posting?.id || ""),
    jobTitle: String(posting?.title || ""),
    jobLocation: formatJobLocation(location),
    hostCity,
    stadiumName,
    stadiumAddress,
    worksiteDisplay,
    documentUrl: String(form.document_url?.value || "").trim(),
    cvUrl: String(form.cv_url?.value || "").trim(),
    coverLetterUrl: String(form.cover_letter_url?.value || "").trim(),
    approvedAtIso: approvalAt.toISOString(),
    reportingSource: reporting.source,
    reportingDateIso: reporting.reportingDateIso,
    reportingDateLabel: reporting.reportingDateLabel,
    reportingTimeLabel: reporting.reportingTimeLabel,
    reportingDateTimeIso: reporting.reportingDateTimeIso,
    reportingInstruction: reporting.reportingInstruction,
    fees: serializeRoleFees(fees),
    paymentExplanation: fees.paymentExplanation,
    paymentUrl: "",
  };

  context.paymentUrl = buildPaymentUrl(context);
  return context;
}

export function buildFollowUpPayload(context) {
  return {
    name: context.name,
    email: context.email,
    role: context.role,
    applicationId: context.applicationId,
    jobId: context.jobId,
    jobTitle: context.jobTitle,
    jobLocation: context.jobLocation,
    hostCity: context.hostCity,
    stadiumName: context.stadiumName,
    stadiumAddress: context.stadiumAddress,
    reportingDateLabel: context.reportingDateLabel,
    reportingTimeLabel: context.reportingTimeLabel,
    reportingInstruction: context.reportingInstruction,
    reportingSource: context.reportingSource,
    fees: context.fees,
    paymentExplanation: context.paymentExplanation,
    paymentUrl: context.paymentUrl,
    approvedAtIso: context.approvedAtIso,
  };
}
