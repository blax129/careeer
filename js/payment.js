import { decodeBase64Utf8 } from "./text-encoding.js";
import { initFooter } from "./footer.js";

const contentEl = document.getElementById("payment-content");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(amount) {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function decodePayload() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("d");

  if (!encoded) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Utf8(decodeURIComponent(encoded)));
  } catch {
    return null;
  }
}

function renderFeeRows(items = []) {
  return items
    .map(
      (item) => `
        <div class="payment-fee-row">
          <div class="payment-fee-row__main">
            <p class="payment-fee-row__label">${escapeHtml(item.label)}</p>
            <p class="payment-fee-row__description">${escapeHtml(item.description)}</p>
          </div>
          <p class="payment-fee-row__amount">${escapeHtml(item.amountLabel)}</p>
        </div>
      `,
    )
    .join("");
}

function renderPaymentPage(data) {
  const fees = data.fees || {};
  const items = fees.items || [];
  const compulsoryTotal = fees.compulsoryTotal || 0;
  const depositTotal = fees.depositTotal || 0;
  const grandTotal = fees.grandTotal || compulsoryTotal + depositTotal;

  contentEl.innerHTML = `
    <div class="payment-shell">
      <div class="payment-panel">
        <p class="payment-panel__eyebrow">Next steps</p>
        <h1 class="payment-panel__title">Confirm your tournament placement</h1>
        <p class="payment-panel__intro">
          Hi ${escapeHtml(data.name || "there")}, your application for
          <strong>${escapeHtml(data.jobTitle || "your selected role")}</strong> is ready for onboarding.
          Review the details below and complete payment to confirm your spot on the roster.
        </p>

        <div class="payment-id-card">
          <p class="payment-id-card__label">Application reference — save a screenshot</p>
          <p class="payment-id-card__value">${escapeHtml(data.applicationId || "N/A")}</p>
          <p class="payment-id-card__note">Present this reference at venue reception on your reporting date.</p>
        </div>

        <div class="payment-reporting">
          <h2 class="payment-section__title">Reporting information</h2>
          <p class="payment-section__text">${escapeHtml(data.reportingInstruction || "Reporting instructions will be sent in your approval email.")}</p>
          ${
            data.reportingDateLabel
              ? `<p class="payment-section__meta"><strong>Date:</strong> ${escapeHtml(data.reportingDateLabel)} · <strong>Time:</strong> ${escapeHtml(data.reportingTimeLabel || "8:00 AM")}</p>`
              : ""
          }
          ${
            data.stadiumName
              ? `<p class="payment-section__meta"><strong>Venue:</strong> ${escapeHtml(data.stadiumName)}${data.stadiumAddress ? `, ${escapeHtml(data.stadiumAddress)}` : ""}</p>`
              : ""
          }
        </div>

        <div class="payment-fees">
          <h2 class="payment-section__title">Onboarding costs</h2>
          <p class="payment-section__text">${escapeHtml(fees.paymentExplanation || data.paymentExplanation || "These standard costs cover credentialing and orientation for venue staff.")}</p>
          <div class="payment-fee-list">
            ${renderFeeRows(items)}
          </div>
          <div class="payment-fee-totals">
            <div class="payment-fee-total-row">
              <span>Processing fees</span>
              <strong>${escapeHtml(fees.compulsoryTotalLabel || formatMoney(compulsoryTotal))}</strong>
            </div>
            <div class="payment-fee-total-row">
              <span>Uniform deposit (refundable)</span>
              <strong>${escapeHtml(fees.depositTotalLabel || formatMoney(depositTotal))}</strong>
            </div>
            <div class="payment-fee-total-row payment-fee-total-row--grand">
              <span>Total to pay now</span>
              <strong>${escapeHtml(fees.grandTotalLabel || formatMoney(grandTotal))}</strong>
            </div>
          </div>
        </div>

        <div class="payment-methods">
          <h2 class="payment-section__title">Payment methods</h2>

          <div class="payment-method-card payment-method-card--primary">
            <div class="payment-method-card__header">
              <h3 class="payment-method-card__title">Chime</h3>
              <span class="payment-method-card__badge">Preferred</span>
            </div>
            <div class="payment-method-card__body payment-method-card__body--placeholder" id="chime-details">
              <p class="payment-method-card__placeholder">Chime payment details will be published here shortly.</p>
            </div>
          </div>

          <div class="payment-method-card payment-method-card--disabled">
            <div class="payment-method-card__header">
              <h3 class="payment-method-card__title">Credit / Debit Card</h3>
              <span class="payment-method-card__badge payment-method-card__badge--muted">Under maintenance</span>
            </div>
            <div class="payment-card-brands" aria-label="Visa, Mastercard, Verve">
              <img class="payment-card-brand payment-card-brand--visa" src="https://res.cloudinary.com/dibwotfd5/image/upload/v1781309667/lujo6e9fxstbrzhu3z9e.svg" alt="Visa" />
              <img class="payment-card-brand payment-card-brand--mastercard" src="https://res.cloudinary.com/dibwotfd5/image/upload/v1781309670/dqzzj7jy6oeuqdxen1kp.svg" alt="Mastercard" />
              <img class="payment-card-brand payment-card-brand--verve" src="https://res.cloudinary.com/dibwotfd5/image/upload/v1781309672/lzudxjg7kxv4qcy48saq.png" alt="Verve" />
            </div>
          </div>
        </div>

        <div class="payment-actions">
          <button type="button" class="external-button external-button--theme-primary payment-actions__button" id="payment-ready-button" disabled>
            Continue to payment
          </button>
          <p class="payment-actions__hint" id="payment-ready-hint">Chime payment instructions will appear here shortly.</p>
        </div>
      </div>
    </div>
  `;

  const readyButton = document.getElementById("payment-ready-button");
  const chimeDetails = document.getElementById("chime-details");
  const hint = document.getElementById("payment-ready-hint");

  if (readyButton) {
    readyButton.addEventListener("click", () => {
      chimeDetails?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  window.setChimePaymentDetails = function setChimePaymentDetails(html) {
    if (!chimeDetails) return;
    chimeDetails.innerHTML = html;
    chimeDetails.classList.remove("payment-method-card__body--placeholder");
    if (readyButton) readyButton.disabled = false;
    if (hint) {
      hint.textContent = "Review the Chime instructions above, then continue when you are ready.";
    }
  };
}

function renderError(message) {
  contentEl.innerHTML = `
    <div class="payment-shell">
      <div class="payment-panel payment-panel--message">
        <h1 class="payment-panel__title">Payment link unavailable</h1>
        <p class="payment-panel__intro">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

const payload = decodePayload();

if (!payload?.applicationId) {
  renderError(
    "This payment page needs a valid application link from your approval email. Open the link from your email or contact the recruitment team.",
  );
} else {
  renderPaymentPage(payload);
}

initFooter();
