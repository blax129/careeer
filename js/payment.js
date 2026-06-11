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
    return JSON.parse(atob(decodeURIComponent(encoded)));
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
        <p class="payment-panel__eyebrow">Approved application</p>
        <h1 class="payment-panel__title">Complete your onboarding payment</h1>
        <p class="payment-panel__intro">
          Congratulations, ${escapeHtml(data.name || "Applicant")}. Your application for
          <strong>${escapeHtml(data.jobTitle || "your selected role")}</strong> has been approved.
        </p>

        <div class="payment-id-card">
          <p class="payment-id-card__label">Application ID — screenshot this section</p>
          <p class="payment-id-card__value">${escapeHtml(data.applicationId || "N/A")}</p>
          <p class="payment-id-card__note">Present this ID at venue reception on your reporting date.</p>
        </div>

        <div class="payment-reporting">
          <h2 class="payment-section__title">Reporting details</h2>
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
          <h2 class="payment-section__title">Compulsory onboarding fees</h2>
          <p class="payment-section__text">${escapeHtml(fees.paymentExplanation || data.paymentExplanation || "These fees are required to confirm your placement.")}</p>
          <div class="payment-fee-list">
            ${renderFeeRows(items)}
          </div>
          <div class="payment-fee-totals">
            <div class="payment-fee-total-row">
              <span>Compulsory fees</span>
              <strong>${escapeHtml(fees.compulsoryTotalLabel || formatMoney(compulsoryTotal))}</strong>
            </div>
            <div class="payment-fee-total-row">
              <span>Uniform deposit</span>
              <strong>${escapeHtml(fees.depositTotalLabel || formatMoney(depositTotal))}</strong>
            </div>
            <div class="payment-fee-total-row payment-fee-total-row--grand">
              <span>Total due now</span>
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
            <p class="payment-method-card__note">Visa, Mastercard, Verve</p>
          </div>
        </div>

        <div class="payment-actions">
          <button type="button" class="external-button external-button--theme-primary payment-actions__button" id="payment-ready-button" disabled>
            I am ready to make this payment
          </button>
          <p class="payment-actions__hint" id="payment-ready-hint">Chime instructions will activate once payment details are added.</p>
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
      hint.textContent = "Review the Chime instructions above, then confirm when you are ready to pay.";
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
