const REPORTING_HOUR = 8;
const REPORTING_MINUTE = 0;
/** Unified resumption Monday for all roles and host cities. */
const FIXED_REPORTING_DATE = "2026-06-22";

function parseIsoDate(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toLocalIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * All applicants report on the same resumption Monday (22 June 2026).
 * Time, venue, and stadium details still come from the job posting.
 */
export function resolveReportingSchedule({
  hostCity = "",
  stadiumName = "",
  stadiumAddress = "",
} = {}) {
  const reportingDate = parseIsoDate(FIXED_REPORTING_DATE);

  const reportingDateTime = new Date(
    reportingDate.getFullYear(),
    reportingDate.getMonth(),
    reportingDate.getDate(),
    REPORTING_HOUR,
    REPORTING_MINUTE,
    0,
    0,
  );

  const venueLabel = stadiumName
    ? stadiumAddress
      ? `${stadiumName}, ${stadiumAddress}`
      : stadiumName
    : hostCity || "your assigned venue";

  const instruction = `Please report to the reception desk at ${venueLabel} by ${formatTime(reportingDateTime)} on ${formatLongDate(reportingDate)}. Bring a screenshot of your Application ID to present to the attendant.`;

  return {
    source: "fixed",
    hostCity,
    reportingDateIso: toLocalIsoDate(reportingDate),
    reportingDateLabel: formatLongDate(reportingDate),
    reportingTimeLabel: formatTime(reportingDateTime),
    reportingDateTimeIso: reportingDateTime.toISOString(),
    reportingInstruction: instruction,
    stadiumName,
    stadiumAddress,
  };
}
