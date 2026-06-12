import { resolveJobPay } from "./job-pay.js";

const MIN_GRAND_TOTAL = 70;
const MAX_GRAND_TOTAL = 110;

const SECURITY_ROLES = new Set([
  "security_exterior",
  "crowd_management",
  "hospitality_security",
  "pitch_security",
  "psa_vsa",
  "airport_supervisor",
]);

const LEADERSHIP_ROLES = new Set([
  "vip_lounge_mgr",
  "vip_hotel_mgr",
  "venue_ops_mgr",
  "venue_hotel_mgr",
  "deputy_workforce_mgr",
  "warehouse_mgr",
]);

/** Grand totals land between $70 and $110 depending on role band. */
const FEE_AMOUNTS = {
  standard: { admin: 20, background: 18, medical: 15, training: 17, uniform: 15 },
  mid: { admin: 23, background: 20, medical: 17, training: 19, uniform: 17 },
  security: { admin: 22, background: 25, medical: 17, training: 19, uniform: 17 },
  leadership: { admin: 28, background: 22, medical: 18, training: 20, uniform: 20 },
};

const FEE_LINE_COPY = {
  admin: {
    label: "Registration & workforce admin",
    description: "ID badge, lanyard, and assignment paperwork",
  },
  background: {
    label: "Security clearance processing",
    description: "Standard background review for venue access",
  },
  medical: {
    label: "Health & safety screening",
    description: "Brief screening required for event insurance coverage",
  },
  training: {
    label: "Venue orientation session",
    description: "On-site procedures, coordination tools, and emergency protocols",
  },
  uniform: {
    label: "Uniform kit deposit",
    description: "Refundable when your kit is returned at the end of your assignment",
  },
};

export const PAYMENT_EXPLANATION =
  "These standard onboarding costs cover credentialing, clearance, and orientation for tournament venue staff. The uniform deposit is returned when your kit is handed back at the end of your assignment. Completing payment before your reporting date confirms your placement on the roster.";

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
      return Number(dayMatch[1].replace(/,/g, "")) / 8;
    }
  }

  const hourMatch = String(pay.payLabel || "").match(/\$([\d,]+)/);
  if (hourMatch) {
    return Number(hourMatch[1].replace(/,/g, ""));
  }

  return 28;
}

function getFeeBand(roleKey, hourlyRate) {
  if (LEADERSHIP_ROLES.has(roleKey)) {
    return "leadership";
  }

  if (SECURITY_ROLES.has(roleKey)) {
    return "security";
  }

  if (hourlyRate >= 30) {
    return "mid";
  }

  return "standard";
}

function buildFeeItems(roleKey, amounts) {
  const copy = FEE_LINE_COPY;
  const medicalAmount =
    roleKey === "medical_care_navigator" ? Math.min(amounts.medical + 3, 22) : amounts.medical;

  return [
    {
      id: "admin",
      label: copy.admin.label,
      description: copy.admin.description,
      amount: amounts.admin,
      amountLabel: formatMoney(amounts.admin),
      isDeposit: false,
    },
    {
      id: "background",
      label: copy.background.label,
      description: copy.background.description,
      amount: amounts.background,
      amountLabel: formatMoney(amounts.background),
      isDeposit: false,
    },
    {
      id: "medical",
      label: copy.medical.label,
      description: copy.medical.description,
      amount: medicalAmount,
      amountLabel: formatMoney(medicalAmount),
      isDeposit: false,
    },
    {
      id: "training",
      label: copy.training.label,
      description: copy.training.description,
      amount: amounts.training,
      amountLabel: formatMoney(amounts.training),
      isDeposit: false,
    },
    {
      id: "uniform",
      label: copy.uniform.label,
      description: copy.uniform.description,
      amount: amounts.uniform,
      amountLabel: `${formatMoney(amounts.uniform)} deposit`,
      isDeposit: true,
    },
  ];
}

function clampGrandTotal(items) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  if (total >= MIN_GRAND_TOTAL && total <= MAX_GRAND_TOTAL) {
    return items;
  }

  if (total > MAX_GRAND_TOTAL) {
    const scale = MAX_GRAND_TOTAL / total;
    return items.map((item) => {
      const amount = Math.max(10, Math.round(item.amount * scale));
      return {
        ...item,
        amount,
        amountLabel: item.isDeposit
          ? `${formatMoney(amount)} deposit`
          : formatMoney(amount),
      };
    });
  }

  return items;
}

/**
 * Onboarding fees for tournament venue staff — totals between $70 and $110.
 */
export function resolveRoleFees(posting, roleKey) {
  const pay = resolveJobPay(posting);
  const hourlyRate = getHourlyRate(posting, pay);
  const band = getFeeBand(roleKey, hourlyRate);
  const amounts = { ...FEE_AMOUNTS[band] };
  let items = buildFeeItems(roleKey, amounts);
  items = clampGrandTotal(items);

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
    feeBand: band,
    items,
    compulsoryTotal,
    depositTotal,
    grandTotal,
    compulsoryTotalLabel: formatMoney(compulsoryTotal),
    depositTotalLabel: formatMoney(depositTotal),
    grandTotalLabel: formatMoney(grandTotal),
    paymentExplanation: PAYMENT_EXPLANATION,
  };
}

export function serializeRoleFees(fees) {
  return {
    hourlyRate: fees.hourlyRate,
    payLabel: fees.payLabel,
    payDetail: fees.payDetail,
    isMatchDay: fees.isMatchDay,
    feeBand: fees.feeBand,
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
