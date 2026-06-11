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
  if (hourMatch) {
    return Number(hourMatch[1].replace(/,/g, ""));
  }

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

function buildFeeItems(roleKey, hourlyRate, pay) {
  const tier = getPayTier(hourlyRate);
  const tierMultiplier = TIER_MULTIPLIERS[tier];
  const profile = ROLE_PROFILES[roleKey] || {};
  const matchDayBoost = pay?.isMatchDay ? 1.08 : 1;

  const admin = roundToFive(
    hourlyRate * 1.05 * tierMultiplier * (profile.admin || 1) * matchDayBoost,
  );
  const background = roundToFive(
    hourlyRate * 0.95 * tierMultiplier * (profile.background || 1) * matchDayBoost,
  );
  const medical = roundToFive(
    hourlyRate * 0.75 * tierMultiplier * (profile.medical || 1) * matchDayBoost,
  );
  const training = roundToFive(
    hourlyRate * 0.9 * tierMultiplier * (profile.training || 1) * matchDayBoost,
  );
  const uniform = roundToFive(
    hourlyRate * 0.7 * tierMultiplier * (profile.uniform || 1) * matchDayBoost,
  );

  return [
    {
      id: "admin",
      label: "Staff registration & admin fee",
      description: "Onboarding, ID card, lanyard, and contract processing",
      amount: admin,
      amountLabel: formatMoney(admin),
      isDeposit: false,
    },
    {
      id: "background",
      label: "Background check & security clearance",
      description: "Mandatory for all tournament operations personnel",
      amount: background,
      amountLabel: formatMoney(background),
      isDeposit: false,
    },
    {
      id: "medical",
      label: "Medical screening",
      description: "Required for event insurance compliance",
      amount: medical,
      amountLabel: formatMoney(medical),
      isDeposit: false,
    },
    {
      id: "training",
      label: "Tournament operations training",
      description: "Venue procedures, coordination systems, and emergency protocols",
      amount: training,
      amountLabel: formatMoney(training),
      isDeposit: false,
    },
    {
      id: "uniform",
      label: "Uniform kit deposit",
      description: "Returnable at end of event — deposit refunded on return",
      amount: uniform,
      amountLabel: `${formatMoney(uniform)} deposit`,
      isDeposit: true,
    },
  ];
}

/**
 * Compulsory onboarding fees derived from role salary band and role profile.
 */
export function resolveRoleFees(posting, roleKey) {
  const pay = resolveJobPay(posting);
  const hourlyRate = getHourlyRate(posting, pay);
  const items = buildFeeItems(roleKey, hourlyRate, pay);
  const compulsoryTotal = items
    .filter((item) => !item.isDeposit)
    .reduce((sum, item) => sum + item.amount, 0);
  const depositTotal = items
    .filter((item) => item.isDeposit)
    .reduce((sum, item) => sum + item.amount, 0);
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
    paymentExplanation:
      "These compulsory fees cover tournament onboarding, credentialing, compliance screening, and role-specific training. The uniform deposit is refundable when your kit is returned at the end of your assignment. Payment must be completed before your reporting date to confirm your placement.",
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
