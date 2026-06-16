import { getMatchDatesForHostCity, TOURNAMENT_END } from "./match-schedule.js";

const REPORTING_HOUR = 8;
const REPORTING_MINUTE = 0;
const MIN_DAYS_AFTER_APPROVAL = 2;

/** Monday of the week after the anchor date's calendar week (ISO week, Mon–Sun). */
function shiftToNextWeekMonday(date) {
  const base = startOfDay(date);
  const daysSinceMonday = (base.getDay() + 6) % 7;
  const thisWeekMonday = addDays(base, -daysSinceMonday);
  return addDays(thisWeekMonday, 7);
}

function toLocalIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function normalizeMatchDatesToReportingMondays(isoDates) {
  const seen = new Set();

  return isoDates
    .map((iso) => toLocalIsoDate(shiftToNextWeekMonday(parseIsoDate(iso))))
    .filter((iso) => {
      if (seen.has(iso)) return false;
      seen.add(iso);
      return true;
    })
    .sort();
}

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
 * Pick the first venue reporting Monday (week after the match week) that is at least 2 days after approval.
 * Falls back to approval + 2 days (also moved to next-week Monday) when no schedule exists for the host city.
 */
export function resolveReportingSchedule({
  approvalAt = new Date(),
  hostCity = "",
  stadiumName = "",
  stadiumAddress = "",
} = {}) {
  const approvalDate = approvalAt instanceof Date ? approvalAt : new Date(approvalAt);
  const earliest = shiftToNextWeekMonday(
    startOfDay(addDays(approvalDate, MIN_DAYS_AFTER_APPROVAL)),
  );
  const tournamentEnd = parseIsoDate(TOURNAMENT_END);
  const matchDates = normalizeMatchDatesToReportingMondays(getMatchDatesForHostCity(hostCity));

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
    reportingDateIso: toLocalIsoDate(reportingDate),
    reportingDateLabel: formatLongDate(reportingDate),
    reportingTimeLabel: formatTime(reportingDateTime),
    reportingDateTimeIso: reportingDateTime.toISOString(),
    reportingInstruction: instruction,
    stadiumName,
    stadiumAddress,
  };
}
