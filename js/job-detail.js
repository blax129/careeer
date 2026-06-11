import {
  ACCOMMODATION_LABEL,
  formatJobLocation,
  isVisibleJob,
  normalizeJob,
} from "./job-filters.js";
import { fetchPostings } from "./fetch-postings.js";
import { resolveJobPay } from "./job-pay.js";
import {
  formatSlotsLabel,
  getRemainingSlots,
  loadFilledCounts,
  renderSlotsMarkup,
} from "./position-slots.js";
import "./back-button.js";

const contentEl = document.getElementById("job-detail-content");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function renderMetaItem(label, value) {
  if (!value) return "";

  return `
    <div class="job-detail__meta-item">
      <span class="job-detail__meta-label">${escapeHtml(label)}</span>
      <span class="job-detail__meta-value">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderSection(title, html) {
  if (!hasMeaningfulHtml(html)) return "";

  return `
    <section class="job-detail__section">
      <h2 class="job-detail__section-title">${escapeHtml(title)}</h2>
      <div class="job-detail__section-body">${html}</div>
    </section>
  `;
}

const POSITION_BOILERPLATE =
  /At FIFA26, our vision is to unite the world[\s\S]*?extraordinary and unforgettable experience\.\s*(?:<br\s*\/?>\s*)*/i;

function hasMeaningfulHtml(html) {
  if (!html?.trim()) return false;

  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 0;
}

function stripPositionBoilerplate(html) {
  if (!html?.trim()) return "";

  return html
    .replace(POSITION_BOILERPLATE, "")
    .replace(/^(?:\s|<br\s*\/?>)+/gi, "")
    .replace(/^<div><!--block--><\/div>$/i, "")
    .trim();
}

function removeApplyButton() {
  document.getElementById("job-apply-floating")?.remove();
}

function renderApplyButton(jobId) {
  removeApplyButton();
  if (!jobId) return;

  const button = document.createElement("a");
  button.id = "job-apply-floating";
  button.className = "floating-cta external-button external-button--theme-primary";
  button.href = `./apply.html?id=${encodeURIComponent(jobId)}`;
  button.textContent = "Apply on FIFA Careers";
  document.body.appendChild(button);
}

function renderJob(posting) {
  const job = posting.job || {};
  const location = posting.location || {};
  const department = job.department || {};
  const entity = job.structure_custom_group_one || {};
  const pay = resolveJobPay(posting);
  const slotsRemaining = getRemainingSlots(posting.id);

  document.title = `${posting.title} | FIFA Careers`;

  const meta = [
    renderMetaItem("Entity", entity.name),
    renderMetaItem("Department", department.name),
    renderMetaItem("Location", formatJobLocation(location)),
    renderMetaItem("Accommodation", ACCOMMODATION_LABEL),
    renderMetaItem("Contract", pay.contractLabel),
    renderMetaItem("Availability", formatSlotsLabel(slotsRemaining)),
    renderMetaItem(
      "Pay",
      pay.isMatchDay ? `${pay.payLabel} · ${pay.payDetail}` : `${pay.payLabel} · ${pay.weeklyLabel}`,
    ),
    renderMetaItem("Workplace", posting.workplace_type_text || posting.workplace_type),
  ].join("");

  const payNote = pay.payNote;

  const payInformationHtml = `
    <p>The amount shown above is a <strong>fixed rate</strong> for this role under a ${escapeHtml(pay.contractLabel.toLowerCase())}.</p>
    ${
      pay.isMatchDay
        ? `<p>Match-day roles are paid per scheduled shift. Your total earnings depend on how many match days you work during the tournament—not on a standard weekly paycheck.</p>
           <p><strong>${escapeHtml(pay.payLabel)}</strong> (${escapeHtml(pay.payDetail)}).</p>`
        : `<p>Based on a <strong>40-hour work week</strong>, that equals <strong>${escapeHtml(pay.weeklyLabel)}</strong>.</p>
           <p><strong>${escapeHtml(pay.payLabel)}</strong> · ${escapeHtml(pay.payDetail)}.</p>`
    }
  `;

  const sections = [
    renderSection("The position", stripPositionBoilerplate(posting.description)),
    renderSection(
      posting.key_responsibilities_header || "Key responsibilities",
      posting.key_responsibilities,
    ),
    renderSection(
      posting.skills_knowledge_expertise_header || "Your profile",
      posting.skills_knowledge_expertise,
    ),
    renderSection("Pay information", payInformationHtml),
    /pay information/i.test(posting.benefits_header || "")
      ? ""
      : renderSection(posting.benefits_header || "Benefits", posting.benefits),
  ].join("");

  contentEl.innerHTML = `
    <header class="job-detail__header">
      <h1 class="job-detail__title">${escapeHtml(posting.title)}</h1>
      ${renderSlotsMarkup(slotsRemaining, "job-detail__slots")}
      <div class="job-detail__pay-banner">
        <p class="job-detail__pay-amount">${escapeHtml(pay.payLabel)}</p>
        <p class="job-detail__pay-detail">${escapeHtml(pay.payDetail)}</p>
        <p class="job-detail__pay-contract">${escapeHtml(pay.contractLabel)}</p>
        <p class="job-detail__pay-note">${escapeHtml(payNote)}</p>
      </div>
      <div class="job-detail__meta">${meta}</div>
    </header>
    ${sections}
  `;

  renderApplyButton(posting.id);
}

function renderError(message) {
  removeApplyButton();

  contentEl.innerHTML = `
    <div class="job-detail__error">
      <h1 class="job-detail__title">Position not found</h1>
      <p>${escapeHtml(message)}</p>
      <a class="external-button external-button--theme-primary" href="./open-positions.html">Back to open positions</a>
    </div>
  `;
}

async function loadJobDetail() {
  if (!contentEl) return;

  const jobId = new URLSearchParams(window.location.search).get("id");
  if (!jobId) {
    renderError("This page is missing a job reference.");
    return;
  }

  try {
    const payload = await fetchPostings();
    const posting = payload.data.find((item) => String(item.id) === String(jobId));

    if (!posting || !isVisibleJob(normalizeJob(posting))) {
      renderError("We could not find that position. It may have been filled or removed.");
      return;
    }

    await loadFilledCounts();
    renderJob(posting);
  } catch (error) {
    renderError("Unable to load this position. Please try again later.");
    console.error(error);
  }
}

loadJobDetail();
