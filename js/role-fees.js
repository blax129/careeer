import { resolveJobPay } from "./job-pay.js";

const HOURS_PER_MATCH_DAY = 8;
const HOURS_PER_WEEK = 40;

function roundToFive(amount) {
  return Math.max(5, Math.round(Number(amount) / 5) * 5);
}

function formatMoney(amount) {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getHourlyRate(posting, pay) {
  if (pay?.isMatchDay) {
    const dayMatch = String(pay.payLabel || "").match(/\$([\d,]+)/);
    if (dayMatch) {
      const dayRate = Number(dayMatch[1].replace(/,/g, ""));
      return dayRate / HOURS_PER_MATCH_DAY;
    }
  }

  const hourMatch = String(pay.payLabel || "").match(/\$([\d,]+)/);
  if (hourMatch) return Number(hourMatch[1].replace(/,/g, ""));

  const disclosed = resolveJobPay(posting);
  const label = disclosed.payLabel || "";
  const match = label.match(/\$([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : 30;
}

function getPayTier(hourlyRate) {
  if (hourlyRate >= 36) return "high";
  if (hourlyRate >= 28) return "mid";
  return "standard";
}

const ROLE_PROFILES = {
  security_exterior: { background: 1.35, training: 1.2, admin: 1.1 },
  crowd_management: { background: 1.3, training: 1.15, admin: 1.05 },
  hospitality_security: { background: 1.28, training: 1.1, admin: 1.05 },
  pitch_security: { background: 1.32, training: 1.2, admin: 1.08 },
  psa_vsa: { background: 1.25, training: 1.15, admin: 1.05 },
  medical_care_navigator: { medical: 1.45, training: 1.1, admin: 1.05 },
  live_stream_tech: { training: 1.25, admin: 1.1, uniform: 0.9 },
  vip_lounge_mgr: { admin: 1.35, uniform: 1.25, training: 1.15 },
  vip_hotel_mgr: { admin: 1.3, uniform: 1.2, training: 1.1 },
  venue_ops_mgr: { admin: 1.28, training: 1.2, background: 1.1 },
  deputy_workforce_mgr: { admin: 1.25, training: 1.15, background: 1.08 },
  warehouse_mgr: { uniform: 1.2, training: 1.05, background: 1.05 },
  airport_supervisor: { background: 1.2, training: 1.1, admin: 1.08 },
  biz_ops_finance: { admin: 1.15, training: 1.05, background: 0.95 },
};

const TIER_MULTIPLIERS = {
  standard: 1,
  mid: 1.12,
  high: 1.28,
};

const ADMIN_COPY = {
  label: "Onboarding & registration fee",
  description:
    "Covers your staff ID, accreditation lanyard, credential pack, and contract administration.",
};

const BACKGROUND_COPY = {
  label: "Pre-employment screening",
  description: "Background verification and security clearance required before credentialing.",
};

const MEDICAL_COPY = {
  label: "Health & fitness assessment",
  description:
    "Occupational health check required for event insurance and venue access approval.",
};

const TRAINING_COPY = {
  standard: {
    label: "Role induction & training",
    description: "Venue familiarisation, match-day procedures, and safety briefing.",
  },
  mid: {
    label: "Specialist role training",
    description: "Role-specific certification, operational protocols, and emergency readiness.",
  },
  high: {
    label: "Leadership & operational training",
    description:
      "Senior-level induction covering team oversight, escalation procedures, and compliance.",
  },
};

const UNIFORM_COPY = {
  label: "Uniform & equipment deposit",
  description:
    "Refundable deposit for your issued uniform and equipment. Returned in full when kit is handed back at the end of your assignment.",
};

function buildPaymentExplanation(tier, isMatchDay) {
  const context = isMatchDay ? "match-day placement" : "tournament assignment";
  return (
    `These fees cover your onboarding, pre-employment screening, health assessment, and role training ` +
    `required to confirm your ${context} at the FIFA World Cup 2026. ` +
    `The uniform deposit is fully refundable on return of your issued kit at the end of your contract.`
  );
}

const BASE_SCALE = 0.55;
const GRAND_CAP = 110;

function capToGrandLimit(items) {
  const rawGrand = items.reduce((s, i) => s + i.amount, 0);
  if (rawGrand <= GRAND_CAP) return items;

  const scale = GRAND_CAP / rawGrand;
  return items.map((item) => ({
    ...item,
    amount: roundToFive(item.amount * scale),
  }));
}

function buildFeeItems(roleKey, hourlyRate, pay) {
  const tier = getPayTier(hourlyRate);
  const tierMultiplier = TIER_MULTIPLIERS[tier];
  const profile = ROLE_PROFILES[roleKey] || {};
  const matchDayBoost = pay?.isMatchDay ? 1.08 : 1;

  const rawItems = [
    {
      id: "admin",
      ...ADMIN_COPY,
      amount: roundToFive(
        hourlyRate *
          1.05 *
          tierMultiplier *
          (profile.admin || 1) *
          matchDayBoost *
          BASE_SCALE,
      ),
      isDeposit: false,
    },
    {
      id: "background",
      ...BACKGROUND_COPY,
      amount: roundToFive(
        hourlyRate *
          0.95 *
          tierMultiplier *
          (profile.background || 1) *
          matchDayBoost *
          BASE_SCALE,
      ),
      isDeposit: false,
    },
    {
      id: "medical",
      ...MEDICAL_COPY,
      amount: roundToFive(
        hourlyRate *
          0.75 *
          tierMultiplier *
          (profile.medical || 1) *
          matchDayBoost *
          BASE_SCALE,
      ),
      isDeposit: false,
    },
    {
      id: "training",
      ...(TRAINING_COPY[tier] || TRAINING_COPY.standard),
      amount: roundToFive(
        hourlyRate *
          0.9 *
          tierMultiplier *
          (profile.training || 1) *
          matchDayBoost *
          BASE_SCALE,
      ),
      isDeposit: false,
    },
    {
      id: "uniform",
      ...UNIFORM_COPY,
      amount: roundToFive(
        hourlyRate *
          0.7 *
          tierMultiplier *
          (profile.uniform || 1) *
          matchDayBoost *
          BASE_SCALE,
      ),
      isDeposit: true,
    },
  ];

  return capToGrandLimit(rawItems).map((item) => ({
    ...item,
    amountLabel: item.isDeposit ? `${formatMoney(item.amount)} deposit` : formatMoney(item.amount),
  }));
}

/**
 * Compulsory onboarding fees derived from role salary band and role profile.
 */
export function resolveRoleFees(posting, roleKey) {
  const pay = resolveJobPay(posting);
  const hourlyRate = getHourlyRate(posting, pay);
  const items = buildFeeItems(roleKey, hourlyRate, pay);

  const compulsoryTotal = items.filter((i) => !i.isDeposit).reduce((s, i) => s + i.amount, 0);

  const depositTotal = items.filter((i) => i.isDeposit).reduce((s, i) => s + i.amount, 0);

  const grandTotal = compulsoryTotal + depositTotal;

  return {
    roleKey,
    hourlyRate,
    payLabel: pay.payLabel,
    payDetail: pay.payDetail,
    isMatchDay: pay.isMatchDay,
    items,
    compulsoryTotal,
    depositTotal,
    grandTotal,
    compulsoryTotalLabel: formatMoney(compulsoryTotal),
    depositTotalLabel: formatMoney(depositTotal),
    grandTotalLabel: formatMoney(grandTotal),
    paymentExplanation: buildPaymentExplanation(getPayTier(hourlyRate), pay.isMatchDay),
  };
}

export function serializeRoleFees(fees) {
  return {
    hourlyRate: fees.hourlyRate,
    payLabel: fees.payLabel,
    payDetail: fees.payDetail,
    isMatchDay: fees.isMatchDay,
    compulsoryTotal: fees.compulsoryTotal,
    depositTotal: fees.depositTotal,
    grandTotal: fees.grandTotal,
    compulsoryTotalLabel: fees.compulsoryTotalLabel,
    depositTotalLabel: fees.depositTotalLabel,
    grandTotalLabel: fees.grandTotalLabel,
    paymentExplanation: fees.paymentExplanation,
    items: fees.items.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      amount: item.amount,
      amountLabel: item.amountLabel,
      isDeposit: item.isDeposit,
    })),
  };
}
