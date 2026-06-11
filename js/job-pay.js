const HOURS_PER_YEAR = 2080;
const HOURS_PER_WEEK = 40;
const HOURS_PER_MATCH_DAY = 8;

function postingText(posting) {
  return [
    posting.description,
    posting.key_responsibilities,
    posting.skills_knowledge_expertise,
    posting.benefits,
    posting.compensation,
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDollars(amount) {
  const value = Number(amount);
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function parseAmountToken(token) {
  const cleaned = token.replace(/,/g, "").trim().toLowerCase();
  if (cleaned.endsWith("k")) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000);
  }
  return Math.round(parseFloat(cleaned));
}

function hourlyRate(amount, unit) {
  if (unit === "hour") return amount;
  if (unit === "day") return amount / HOURS_PER_MATCH_DAY;
  if (unit === "year") return amount / HOURS_PER_YEAR;
  return amount;
}

function formatHourlyPay(amount) {
  return `${formatDollars(Math.round(amount))} / hour`;
}

function toPayDetails(amount, unit) {
  return {
    sourceAmount: amount,
    sourceUnit: unit,
    hourlyRate: hourlyRate(amount, unit),
  };
}

function parseStructuredPayDetails(posting) {
  if (!posting.compensation) return null;

  const amount = posting.compensation_minimum ?? posting.compensation_maximum;
  if (amount == null) return null;

  const frequency = posting.compensation_frequency;
  if (frequency === "hour") return toPayDetails(amount, "hour");
  if (frequency === "day") return toPayDetails(amount, "day");
  if (frequency === "year") return toPayDetails(amount, "year");
  return null;
}

function parseDisclosedPayDetails(posting) {
  const structured = parseStructuredPayDetails(posting);
  if (structured) return structured;

  const text = postingText(posting);

  let match = text.match(
    /salary range for this position is\s*\$([\d,]+k?)\s*-\s*\$([\d,]+k?)/i,
  );
  if (match) {
    return toPayDetails(parseAmountToken(match[1]), "year");
  }

  match = text.match(/pay range for this position is \$([\d,]+(?:\.\d{2})?) per hour/i);
  if (match) {
    return toPayDetails(parseFloat(match[1].replace(/,/g, "")), "hour");
  }

  match = text.match(
    /pay range for this position is \$([\d,]+(?:\.\d{2})?) (?:per day|daily)/i,
  );
  if (match) {
    return toPayDetails(parseFloat(match[1].replace(/,/g, "")), "day");
  }

  return null;
}

function isMatchDay(posting) {
  return /match day only/i.test(posting.title || "");
}

function getCategoryFixedPayDetails(posting) {
  const title = posting.title || "";

  if (isMatchDay(posting)) {
    if (/VIP Lounge Manager/i.test(title)) {
      return toPayDetails(320, "day");
    }

    if (/Gate Supervisor|Food & Beverage Coordinator/i.test(title)) {
      return toPayDetails(225, "day");
    }

    if (/Parking Coordinator/i.test(title)) {
      return toPayDetails(31, "hour");
    }

    if (
      /Stadium.*Security|Crowd Management|PSA\/VSA|Exterior Security/i.test(title)
    ) {
      return toPayDetails(34, "hour");
    }

    if (/Manager/i.test(title)) {
      return toPayDetails(300, "day");
    }

    if (/Coordinator|Fan Operations|catering/i.test(title)) {
      return toPayDetails(28, "hour");
    }

    return toPayDetails(225, "day");
  }

  if (/Manager/i.test(title)) {
    return toPayDetails(93000, "year");
  }

  if (/Senior|Lead|Head of|Director|Chief/i.test(title)) {
    return toPayDetails(95000, "year");
  }

  if (/Specialist/i.test(title)) {
    return toPayDetails(85000, "year");
  }

  if (/Coordinator/i.test(title)) {
    return toPayDetails(65000, "year");
  }

  return toPayDetails(75000, "year");
}

function buildPayPresentation(details, posting, payDisclosed) {
  const matchDay = isMatchDay(posting);
  const hourly = Math.round(details.hourlyRate);

  if (matchDay) {
    const dayRate = Math.round(
      details.sourceUnit === "day"
        ? details.sourceAmount
        : hourly * HOURS_PER_MATCH_DAY,
    );

    return {
      payLabel: `${formatDollars(dayRate)} / match day`,
      payDetail: `${formatHourlyPay(hourly)} · estimated 8-hour shift`,
      weeklyLabel: null,
      payNote:
        "This is a match-day role. You are paid a fixed rate for each scheduled match day—not a guaranteed weekly salary.",
      payDisclosed,
      isMatchDay: true,
    };
  }

  const weekly = hourly * HOURS_PER_WEEK;

  return {
    payLabel: formatHourlyPay(hourly),
    payDetail: `${formatDollars(weekly)} / week`,
    weeklyLabel: `${formatDollars(weekly)} / week`,
    payNote: payDisclosed
      ? "Fixed pay for this fixed-term tournament role, based on a 40-hour work week."
      : "Fixed pay estimate for this role type, based on a 40-hour work week. Final pay is confirmed at offer stage.",
    payDisclosed,
    isMatchDay: false,
  };
}

export function formatContractLabel(employmentType) {
  const value = String(employmentType || "").toLowerCase();

  if (value.includes("fixed_term") || value.includes("fixed term")) {
    return "Fixed term contract";
  }

  if (value.includes("permanent")) {
    return "Permanent contract";
  }

  return "Fixed term contract";
}

export function resolveJobPay(posting) {
  const disclosed = parseDisclosedPayDetails(posting);
  const details = disclosed || getCategoryFixedPayDetails(posting);

  return {
    ...buildPayPresentation(details, posting, Boolean(disclosed)),
    contractLabel: formatContractLabel(
      posting.employment_type_text || posting.employment_type,
    ),
  };
}

// Backward-compatible helper for any code expecting a single label string.
export function parseDisclosedPay(posting) {
  return resolveJobPay(posting).payLabel;
}
