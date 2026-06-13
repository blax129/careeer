import { getMatchDatesForHostCity, TOURNAMENT_END } from "./match-schedule.js";

const REPORTING_HOUR = 8;
const REPORTING_MINUTE = 0;
const MIN_DAYS_AFTER_APPROVAL = 2;

function parseIsoDate(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
 * Pick the first venue match day that is at least 2 days after approval.
 * Falls back to approval + 2 days when no schedule exists for the host city.
 */
export function resolveReportingSchedule({
  approvalAt = new Date(),
  hostCity = "",
  stadiumName = "",
  stadiumAddress = "",
} = {}) {
  const approvalDate = approvalAt instanceof Date ? approvalAt : new Date(approvalAt);
  const earliest = startOfDay(addDays(approvalDate, MIN_DAYS_AFTER_APPROVAL));
  const tournamentEnd = parseIsoDate(TOURNAMENT_END);
  const matchDates = getMatchDatesForHostCity(hostCity);

  let reportingDate = earliest;
  let source = "default";

  for (const iso of matchDates) {
    const candidate = parseIsoDate(iso);
    if (candidate >= earliest && candidate <= tournamentEnd) {
      reportingDate = candidate;
      source = "match_day";
      break;
    }
  }

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

  const instruction =
    source === "match_day"
      ? `Please report to the reception desk at ${venueLabel} by ${formatTime(reportingDateTime)} on ${formatLongDate(reportingDate)}. This date aligns with the next scheduled match-day operations window at your venue. Bring a screenshot of your Application ID to present to the attendant.`
      : `Please report to the reception desk at ${venueLabel} by ${formatTime(reportingDateTime)} on ${formatLongDate(reportingDate)}. Bring a screenshot of your Application ID to present to the attendant.`;

  return {
    source,
    hostCity,
    reportingDateIso: reportingDate.toISOString().slice(0, 10),
    reportingDateLabel: formatLongDate(reportingDate),
    reportingTimeLabel: formatTime(reportingDateTime),
    reportingDateTimeIso: reportingDateTime.toISOString(),
    reportingInstruction: instruction,
    stadiumName,
    stadiumAddress,
  };
}
