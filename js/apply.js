import {
  ACCOMMODATION_LABEL,
  formatJobLocation,
  getRegionalAreaQuestion,
  getWorkAreaProximityQuestion,
  isVisibleJob,
  normalizeJob,
} from "./job-filters.js";
import { fetchPostings } from "./fetch-postings.js";
import { resolveJobPay } from "./job-pay.js";
import {
  getRemainingSlots,
  loadFilledCounts,
  recordApprovedApplication,
  renderSlotsMarkup,
} from "./position-slots.js";
import {
  createApplicationContext,
  scheduleFollowUpEmail,
  sendApplicationConfirmationEmail,
  syncContextFileUrls,
} from "./application-email.js";
import "./back-button.js";
import { initFooter } from "./footer.js";
import { uploadApplicationFiles, uploadFileToCloudinary } from "./cloudinary-upload.js";
import {
  initSupportingDocumentUpload,
  renderSupportingDocumentsSection,
} from "./document-upload-ui.js";

const contentEl = document.getElementById("apply-content");
const FORMSPREE_ENDPOINT = "https://formspree.io/f/mdavpbew";

const LINKEDIN_ICON = `
  <svg class="apply-linkedin-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
`;

const PHONE_COUNTRIES = [
  { iso: "US", label: "United States", dial: "+1" },
  { iso: "CA", label: "Canada", dial: "+1" },
  { iso: "MX", label: "Mexico", dial: "+52" },
  { iso: "GB", label: "United Kingdom", dial: "+44" },
  { iso: "CH", label: "Switzerland", dial: "+41" },
  { iso: "FR", label: "France", dial: "+33" },
  { iso: "DE", label: "Germany", dial: "+49" },
  { iso: "ES", label: "Spain", dial: "+34" },
  { iso: "IT", label: "Italy", dial: "+39" },
  { iso: "BR", label: "Brazil", dial: "+55" },
  { iso: "AR", label: "Argentina", dial: "+54" },
  { iso: "CO", label: "Colombia", dial: "+57" },
  { iso: "AU", label: "Australia", dial: "+61" },
  { iso: "NZ", label: "New Zealand", dial: "+64" },
  { iso: "JP", label: "Japan", dial: "+81" },
  { iso: "KR", label: "South Korea", dial: "+82" },
  { iso: "CN", label: "China", dial: "+86" },
  { iso: "IN", label: "India", dial: "+91" },
  { iso: "ZA", label: "South Africa", dial: "+27" },
  { iso: "NG", label: "Nigeria", dial: "+234" },
  { iso: "AE", label: "United Arab Emirates", dial: "+971" },
];

function countryFlag(iso) {
  return iso
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setBackFallback(jobId) {
  document.body.dataset.backFallback = `./job.html?id=${encodeURIComponent(jobId)}`;
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function renderPhoneCountryOptions(defaultIso = "US") {
  return PHONE_COUNTRIES.map((country) => {
    const selected = country.iso === defaultIso ? " selected" : "";
    const label = `${countryFlag(country.iso)} ${country.label} (${country.dial})`;
    return `<option value="${escapeAttr(country.iso)}" data-dial="${escapeAttr(country.dial)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function setPhoneFields(form, iso, number) {
  const countrySelect = form.querySelector("#apply-phone-country");
  const phoneInput = form.querySelector("#apply-phone");

  if (countrySelect) {
    countrySelect.value = iso;
  }

  if (phoneInput) {
    phoneInput.value = number;
  }
}

function renderSidebarMeta(label, value) {
  if (!value) return "";

  return `
    <div class="apply-sidebar__item">
      <dt class="apply-sidebar__label">${escapeHtml(label)}</dt>
      <dd class="apply-sidebar__value">${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderError(message) {
  contentEl.innerHTML = `
    <div class="apply-shell apply-shell--single">
      <div class="apply-panel apply-panel--message">
        <h1 class="apply-panel__title">Unable to apply</h1>
        <p class="apply-panel__text">${escapeHtml(message)}</p>
        <a class="external-button external-button--theme-primary apply-panel__button" href="./open-positions.html">Back to open positions</a>
      </div>
    </div>
  `;
}

function renderSuccess(
  posting,
  { confirmationEmailSent = false, applicationId = "", emailErrorMessage = "" } = {},
) {
  const emailNote = emailErrorMessage
    ? `<p class="apply-panel__text apply-panel__text--warning">Your application was received, but we could not send a confirmation email: ${escapeHtml(emailErrorMessage)}</p>`
    : `<p class="apply-panel__text">A confirmation email will be sent to the address you provided with details about the next steps. If you do not see it within a few minutes, check your spam or junk folder.</p>`;
  const referenceNote = applicationId
    ? `<p class="apply-panel__text">Your application reference is <strong>${escapeHtml(applicationId)}</strong>.</p>`
    : "";

  contentEl.innerHTML = `
    <div class="apply-shell apply-shell--single">
      <div class="apply-panel apply-panel--message apply-panel--success">
        <p class="apply-panel__eyebrow">Application submitted</p>
        <h1 class="apply-panel__title">Thank you for applying</h1>
        <p class="apply-panel__text">Your application for <strong>${escapeHtml(posting.title)}</strong> has been received.</p>
        ${referenceNote}
        ${emailNote}
        <p class="apply-panel__text">Your application will be reviewed promptly by our team. Applicants who meet our initial requirements may receive an approval decision within 12–24 hours, and in many cases sooner.</p>
        <p class="apply-panel__text">If your application is approved, you will receive a follow-up email with your reporting date, venue instructions, and compulsory onboarding fee details. Please screenshot your Application ID when requested — you will need it at venue reception.</p>
        <a class="external-button external-button--theme-primary apply-panel__button" href="./open-positions.html">View open positions</a>
      </div>
    </div>
  `;
}

function initFileUpload(form, config) {
  const input = form.querySelector(config.inputSelector);
  const trigger = form.querySelector(config.triggerSelector);

  if (!input || !trigger) return;

  trigger.addEventListener("click", () => input.click());

  const urlInput = config.urlInputSelector
    ? form.querySelector(config.urlInputSelector)
    : null;

  let uploadRequestId = 0;

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    const requestId = ++uploadRequestId;

    if (urlInput) {
      urlInput.value = "";
    }

    if (!file) {
      updateUploadTriggerLabel(trigger, config.defaultLabel, false);
      return;
    }

    updateUploadTriggerLabel(trigger, `Uploading ${file.name}...`, true);

    try {
      const secureUrl = await uploadFileToCloudinary(file);
      if (requestId !== uploadRequestId) {
        return;
      }

      if (urlInput) {
        urlInput.value = secureUrl;
      }

      updateUploadTriggerLabel(trigger, file.name, true);
    } catch (error) {
      if (requestId !== uploadRequestId) {
        return;
      }

      input.value = "";
      updateUploadTriggerLabel(trigger, config.defaultLabel, false);
      const errorEl = form.querySelector("#apply-form-error");
      if (errorEl) {
        errorEl.textContent =
          error?.message || "We could not upload that file. Please try again.";
        errorEl.hidden = false;
      }
    }
  });
}

function getCvPlaceholder(form) {
  return form.dataset.linkedinConnected === "true"
    ? "Profile imported from LinkedIn"
    : "Attach Résumé / CV";
}

function updateUploadTriggerLabel(trigger, text, isSelected = false) {
  if (!trigger) return;

  trigger.textContent = text;
  trigger.classList.toggle("is-selected", isSelected);
}

function updateCvTriggerLabel(form, text, isSelected = false) {
  updateUploadTriggerLabel(form.querySelector("#apply-cv-trigger"), text, isSelected);
}

function renderLinkedInButton() {
  return `
    <button type="button" class="external-button external-button--linkedin external-button--compact" id="apply-linkedin-btn">
      ${LINKEDIN_ICON}
      <span>Apply with LinkedIn</span>
    </button>
  `;
}

function initLinkedInApply(form, posting) {
  const button = form.querySelector("#apply-linkedin-btn");
  const modal = form.querySelector("#apply-linkedin-modal");
  const confirmButton = form.querySelector("#apply-linkedin-confirm");
  const cancelButton = form.querySelector("#apply-linkedin-cancel");
  const backdrop = form.querySelector(".apply-linkedin-modal__backdrop");
  const status = form.querySelector("#apply-linkedin-status");
  const linkedinUrlInput = form.querySelector("#apply-linkedin-url");
  const cvInput = form.querySelector("#apply-cv");
  const cvHint = form.querySelector("#apply-cv-hint");

  if (!button || !modal) return;

  const profile = {
    firstName: "Jordan",
    lastName: "Reeves",
    email: "jordan.reeves@example.com",
    phone: "+1 305 555 0142",
    linkedinUrl: "https://www.linkedin.com/in/jordan-reeves",
  };

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("apply-linkedin-modal-open");
    confirmButton?.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("apply-linkedin-modal-open");
    button.focus();
  }

  function setLinkedInConnected() {
    form.dataset.linkedinConnected = "true";

    form.querySelector("#apply-first-name").value = profile.firstName;
    form.querySelector("#apply-last-name").value = profile.lastName;
    form.querySelector("#apply-email").value = profile.email;
    setPhoneFields(form, "US", "305 555 0142");
    linkedinUrlInput.value = profile.linkedinUrl;

    if (cvInput) {
      cvInput.required = false;
      cvInput.value = "";
    }

    const filename = form.querySelector("#apply-cv-trigger");
    if (filename) {
      updateCvTriggerLabel(form, "Profile imported from LinkedIn", true);
    }

    if (cvHint) {
      cvHint.textContent =
        "Your LinkedIn profile has been imported. You can still upload a résumé if you want to add one.";
    }

    if (status) {
      status.hidden = false;
      status.textContent = "LinkedIn profile connected. Your details have been added to this application.";
    }

    button.disabled = true;
    button.classList.add("is-connected");
    button.innerHTML = `${LINKEDIN_ICON}<span>Connected with LinkedIn</span>`;
  }

  button.addEventListener("click", openModal);
  cancelButton?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);

  confirmButton?.addEventListener("click", () => {
    confirmButton.disabled = true;
    confirmButton.textContent = "Connecting...";

    window.setTimeout(() => {
      setLinkedInConnected();
      confirmButton.disabled = false;
      confirmButton.textContent = "Allow and continue";
      closeModal();
    }, 900);
  });

  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });
}

function getRadioAnswer(form, name) {
  const selected = form.querySelector(`input[name="${name}"]:checked`);
  return selected?.value || "not answered";
}

/**
 * Build a JSON payload for Formspree. Files are never attached here —
 * Cloudinary URLs are sent as plain text fields instead.
 */
function buildApplicationPayload(form, posting, context) {
  const location = posting.location || {};
  const pay = resolveJobPay(posting);
  const phoneCountrySelect = form.querySelector("#apply-phone-country");
  const phoneDial =
    phoneCountrySelect?.selectedOptions[0]?.dataset.dial || "";

  return {
    firstName: form.firstName.value.trim(),
    lastName: form.lastName.value.trim(),
    email: form.email.value.trim(),
    _replyto: form.email.value.trim(),
    applicationId: context.applicationId,
    role: context.role,
    phoneCountry: phoneCountrySelect?.value || "",
    phone: `${phoneDial} ${form.phone.value.trim()}`.trim(),
    linkedinUrl: form.linkedinUrl.value.trim(),
    linkedinConnected:
      form.dataset.linkedinConnected === "true" ? "yes" : "no",
    jobId: posting.id,
    jobTitle: posting.title,
    jobLocation: formatJobLocation(location),
    jobPay: `${pay.payLabel} · ${pay.payDetail}`,
    jobContract: pay.contractLabel,
    _subject: `FIFA Careers Application: ${posting.title}`,
    cv_url: context.cvUrl || form.cv_url?.value?.trim() || "not provided",
    cover_letter_url:
      context.coverLetterUrl ||
      form.cover_letter_url?.value?.trim() ||
      "not provided",
    document_url:
      context.documentUrl || form.document_url?.value?.trim() || "not provided",
    basedInArea: getRadioAnswer(form, "basedInArea"),
    availableToStart: getRadioAnswer(form, "availableToStart"),
    flexibleHours: getRadioAnswer(form, "flexibleHours"),
    workAreaProximity: getRadioAnswer(form, "workAreaProximity"),
    footballCommunityExperience: getRadioAnswer(form, "footballCommunityExperience"),
    footballCommunityDetails:
      form.footballCommunityDetails.value.trim() || "not provided",
    consent: form.consent.checked ? "yes" : "no",
  };
}

async function submitApplication(form, posting, context) {
  const response = await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildApplicationPayload(form, posting, context)),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorCodes = payload?.errors?.map((entry) => entry.code).filter(Boolean) || [];
    const fieldMessages =
      payload?.errors?.map((entry) => entry.message).filter(Boolean).join(" ") || "";

    let message =
      payload?.error ||
      fieldMessages ||
      "We could not submit your application. Please try again.";

    if (errorCodes.includes("NO_FILE_UPLOADS")) {
      message =
        "This form cannot accept file attachments. Your documents should upload through Cloudinary before submit — please refresh and try again.";
    }

    throw new Error(message);
  }

  return payload;
}

function renderForm(posting) {
  const job = posting.job || {};
  const location = posting.location || {};
  const department = job.department || {};
  const entity = job.structure_custom_group_one || {};
  const pay = resolveJobPay(posting);
  const locationLabel = formatJobLocation(location);
  const regionalAreaQuestion = getRegionalAreaQuestion(location);
  const workAreaProximityQuestion = getWorkAreaProximityQuestion(location);
  const slotsRemaining = getRemainingSlots(posting.id);

  document.title = `Apply: ${posting.title} | FIFA Careers`;
  setBackFallback(posting.id);

  contentEl.innerHTML = `
    <div class="apply-shell">
      <aside class="apply-sidebar" aria-label="Role summary">
        <p class="apply-sidebar__eyebrow">Apply</p>
        <h1 class="apply-sidebar__title">${escapeHtml(posting.title)}</h1>
        ${renderSlotsMarkup(slotsRemaining, "apply-sidebar__slots")}
        <dl class="apply-sidebar__meta">
          ${renderSidebarMeta("Entity", entity.name)}
          ${renderSidebarMeta("Department", department.name)}
          ${renderSidebarMeta("Location", locationLabel)}
          ${renderSidebarMeta("Employment type", posting.employment_type_text || posting.employment_type)}
          ${renderSidebarMeta("Workplace", posting.workplace_type_text || posting.workplace_type)}
          ${renderSidebarMeta("Pay", `${pay.payLabel} · ${pay.payDetail}`)}
          ${renderSidebarMeta("Contract", pay.contractLabel)}
        </dl>
        <p class="apply-sidebar__note apply-sidebar__note--pay">${escapeHtml(pay.payNote)}</p>
        <p class="apply-sidebar__note">${escapeHtml(ACCOMMODATION_LABEL)}</p>
      </aside>

      <div class="apply-panel">
        <form class="apply-form" id="apply-form" novalidate>
          <section class="apply-form__section">
            <div class="apply-form__section-head">
              <div class="apply-form__section-copy">
                <h2 class="apply-form__section-title"><span class="apply-form__section-number">1.</span> Personal Details</h2>
                <p class="apply-form__section-intro">We'll need these details in order to be able to contact you.</p>
              </div>
              ${renderLinkedInButton()}
            </div>

            <p class="apply-form__linkedin-status" id="apply-linkedin-status" hidden></p>

            <div class="apply-linkedin-modal" id="apply-linkedin-modal" hidden>
              <div class="apply-linkedin-modal__backdrop"></div>
              <div class="apply-linkedin-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="apply-linkedin-modal-title">
                <div class="apply-linkedin-modal__brand">
                  ${LINKEDIN_ICON}
                  <span>LinkedIn</span>
                </div>
                <h3 class="apply-linkedin-modal__title" id="apply-linkedin-modal-title">Apply with LinkedIn</h3>
                <p class="apply-linkedin-modal__text">FIFA Careers would like to access your basic profile information to help complete your application for <strong>${escapeHtml(posting.title)}</strong>.</p>
                <ul class="apply-linkedin-modal__list">
                  <li>Name and contact details</li>
                  <li>Public profile URL</li>
                </ul>
                <div class="apply-linkedin-modal__actions">
                  <button type="button" class="external-button external-button--linkedin apply-linkedin-modal__confirm" id="apply-linkedin-confirm">Allow and continue</button>
                  <button type="button" class="apply-linkedin-modal__cancel" id="apply-linkedin-cancel">Cancel</button>
                </div>
              </div>
            </div>

            <div class="apply-form__field">
              <label class="apply-form__label" for="apply-first-name">First Name</label>
              <input class="apply-form__input" id="apply-first-name" name="firstName" type="text" autocomplete="given-name" required>
            </div>

            <div class="apply-form__field">
              <label class="apply-form__label" for="apply-last-name">Last Name</label>
              <input class="apply-form__input" id="apply-last-name" name="lastName" type="text" autocomplete="family-name" required>
            </div>

            <div class="apply-form__field">
              <label class="apply-form__label" for="apply-email">Email Address</label>
              <input class="apply-form__input" id="apply-email" name="email" type="email" autocomplete="email" required>
            </div>

            <div class="apply-form__field">
              <label class="apply-form__label" for="apply-phone">Phone</label>
              <div class="apply-form__phone">
                <select class="apply-form__select apply-form__phone-country" id="apply-phone-country" name="phoneCountry" aria-label="Country code" required>
                  ${renderPhoneCountryOptions("US")}
                </select>
                <input class="apply-form__input apply-form__phone-number" id="apply-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="Phone number" required>
              </div>
            </div>

            <div class="apply-form__field">
              <label class="apply-form__label" for="apply-linkedin-url">LinkedIn URL <span class="apply-form__optional">(optional)</span></label>
              <input class="apply-form__input" id="apply-linkedin-url" name="linkedinUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://www.linkedin.com/in/your-profile">
            </div>
          </section>

          <section class="apply-form__section">
            <h2 class="apply-form__section-title"><span class="apply-form__section-number">2.</span> Profile</h2>

            <div class="apply-form__field">
              <label class="apply-form__label" for="apply-cv">Résumé / CV <span class="apply-form__optional">(optional)</span></label>
              <p class="apply-form__field-note" id="apply-cv-hint">Optional — upload a résumé in any format, or use Apply with LinkedIn above. Files upload securely when selected.</p>
              <input type="hidden" id="apply-cv-url" name="cv_url" value="">
              <input class="apply-form__upload-input" id="apply-cv" name="cv" type="file">
              <button class="apply-form__upload-trigger" id="apply-cv-trigger" type="button">Attach Résumé / CV</button>
            </div>

            <div class="apply-form__field">
              <label class="apply-form__label" for="apply-cover-letter">Cover Letter</label>
              <p class="apply-form__field-note">This section is optional. Any file type is accepted.</p>
              <input type="hidden" id="apply-cover-letter-url" name="cover_letter_url" value="">
              <input class="apply-form__upload-input" id="apply-cover-letter" name="coverLetter" type="file">
              <button class="apply-form__upload-trigger" id="apply-cover-letter-trigger" type="button">Attach Cover Letter</button>
            </div>
          </section>

          ${renderSupportingDocumentsSection()}

          <section class="apply-form__section">
            <h2 class="apply-form__section-title"><span class="apply-form__section-number">4.</span> Questions</h2>
            <p class="apply-form__section-intro">All questions in this section are optional.</p>

            <div class="apply-form__subsection apply-form__subsection--location">
              <p class="apply-form__location-question">${escapeHtml(regionalAreaQuestion)}</p>
              <p class="apply-form__location-note">Please note that accommodation can be provided</p>
              <fieldset class="apply-form__yes-no">
                <legend class="apply-form__yes-no-legend">Your answer</legend>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="basedInArea" value="yes">
                  <span>Yes</span>
                </label>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="basedInArea" value="no">
                  <span>No</span>
                </label>
              </fieldset>
            </div>

            <div class="apply-form__subsection apply-form__subsection--location">
              <p class="apply-form__location-question">Are you available to start immediately?</p>
              <fieldset class="apply-form__yes-no">
                <legend class="apply-form__yes-no-legend">Your answer</legend>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="availableToStart" value="yes">
                  <span>Yes</span>
                </label>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="availableToStart" value="no">
                  <span>No</span>
                </label>
              </fieldset>
            </div>

            <div class="apply-form__subsection apply-form__subsection--location">
              <p class="apply-form__location-question">Tournament operations may require early morning or late-night shifts, including weekends and holidays. Are you comfortable working flexible hours as needed?</p>
              <fieldset class="apply-form__yes-no">
                <legend class="apply-form__yes-no-legend">Your answer</legend>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="flexibleHours" value="yes">
                  <span>Yes</span>
                </label>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="flexibleHours" value="no">
                  <span>No</span>
                </label>
              </fieldset>
            </div>

            <div class="apply-form__subsection apply-form__subsection--location">
              <p class="apply-form__location-question">${escapeHtml(workAreaProximityQuestion)}</p>
              <fieldset class="apply-form__yes-no apply-form__yes-no--choices">
                <legend class="apply-form__yes-no-legend">Your answer</legend>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="workAreaProximity" value="local">
                  <span>I already live close to the work area</span>
                </label>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="workAreaProximity" value="needs-accommodation">
                  <span>I will need accommodation</span>
                </label>
              </fieldset>
            </div>

            <div class="apply-form__subsection apply-form__subsection--location">
              <p class="apply-form__location-question">Have you ever worked for the football community?</p>
              <fieldset class="apply-form__yes-no">
                <legend class="apply-form__yes-no-legend">Your answer</legend>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="footballCommunityExperience" value="yes">
                  <span>Yes</span>
                </label>
                <label class="apply-form__yes-no-option">
                  <input class="apply-form__yes-no-input" type="radio" name="footballCommunityExperience" value="no">
                  <span>No</span>
                </label>
              </fieldset>
              <div class="apply-form__follow-up">
                <label class="apply-form__label" for="apply-football-community-experience">Please specify your experience in the football community.</label>
                <textarea class="apply-form__textarea" id="apply-football-community-experience" name="footballCommunityDetails" rows="4" placeholder="Describe your role, organisation, and relevant experience"></textarea>
              </div>
            </div>
          </section>

          <section class="apply-form__section apply-form__section--submit">
            <h2 class="apply-form__section-title"><span class="apply-form__section-number">5.</span> Submit Application</h2>
            <p class="apply-form__section-intro">If you are happy for us to store your personal data please click the checkbox below. You can view our <a class="apply-form__link" href="https://jobs.fifa.com/themes/3491/privacy_policy" target="_blank" rel="noopener">privacy notice</a> for more information.</p>

            <div class="apply-form__choice apply-form__choice--consent">
              <input class="apply-form__checkbox" id="apply-consent" name="consent" type="checkbox" required>
              <label class="apply-form__checkbox-label" for="apply-consent">Allow us to process your personal information.</label>
            </div>

            <div class="apply-form__actions">
              <button class="external-button external-button--theme-primary apply-form__submit" type="submit">Submit Application</button>
            </div>
            <p class="apply-form__error" id="apply-form-error" hidden>Please complete all required fields before submitting your application.</p>
          </section>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById("apply-form");
  const errorEl = document.getElementById("apply-form-error");

  initFileUpload(form, {
    inputSelector: "#apply-cv",
    triggerSelector: "#apply-cv-trigger",
    urlInputSelector: "#apply-cv-url",
    defaultLabel: getCvPlaceholder(form),
  });
  initFileUpload(form, {
    inputSelector: "#apply-cover-letter",
    triggerSelector: "#apply-cover-letter-trigger",
    urlInputSelector: "#apply-cover-letter-url",
    defaultLabel: "Attach Cover Letter",
  });
  initLinkedInApply(form, posting);
  const documentUpload = initSupportingDocumentUpload(form);

  const submitButton = form.querySelector(".apply-form__submit");
  const defaultSubmitLabel = submitButton.textContent;
  let isSubmitting = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    errorEl.hidden = true;
    errorEl.textContent =
      "Please complete all required fields before submitting your application.";

    if (!form.checkValidity()) {
      errorEl.hidden = false;
      form.reportValidity();
      return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    form.setAttribute("aria-busy", "true");

    try {
      // Upload files first so upload errors are not confused with later steps.
      const uploadContext = { cvUrl: "", coverLetterUrl: "", documentUrl: "" };
      await uploadApplicationFiles(form, uploadContext, {
        documentUpload,
        onStatus: (label) => {
          submitButton.textContent = label;
        },
      });

      const context = createApplicationContext(form, posting);
      context.cvUrl = uploadContext.cvUrl || context.cvUrl;
      context.coverLetterUrl = uploadContext.coverLetterUrl || context.coverLetterUrl;
      context.documentUrl = uploadContext.documentUrl || context.documentUrl;

      submitButton.textContent = "Submitting application...";

      await submitApplication(form, posting, context);
      syncContextFileUrls(context, form);
      await recordApprovedApplication(posting.id);

      renderSuccess(posting, {
        applicationId: context.applicationId,
        emailErrorMessage: "",
      });

      // Emails run after success so applicants are not left waiting on third-party services.
      void sendApplicationConfirmationEmail(context).catch((error) => {
        console.warn("Confirmation email failed:", error);
        renderSuccess(posting, {
          applicationId: context.applicationId,
          emailErrorMessage:
            error?.message ||
            "We could not send your confirmation email. Please contact support.",
        });
      });

      // Queue Email 2 even if Email 1 fails — they are independent services.
      void scheduleFollowUpEmail(context).catch((error) => {
        console.warn("Follow-up email queue failed:", error);
      });
    } catch (error) {
      const message =
        error.message || "We could not submit your application. Please try again.";

      if (documentUpload?.getSelectedFile() && !form.document_url.value.trim()) {
        documentUpload.setUploadError(message);
      }

      const isResumeUploadError =
        /résumé|resume|cloudinary|upload|document/i.test(message) &&
        form.cv?.files?.[0] &&
        !form.cv_url?.value?.trim();

      errorEl.textContent = isResumeUploadError
        ? `We could not upload your résumé. ${message}`
        : message;
      errorEl.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = defaultSubmitLabel;
      console.error(error);
    } finally {
      isSubmitting = false;
      form.removeAttribute("aria-busy");
    }
  });
}

async function loadApplyPage() {
  if (!contentEl) {
    console.error("Apply page: #apply-content element not found.");
    return;
  }

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
    renderForm(posting);
  } catch (error) {
    renderError("Unable to load this application form. Please try again later.");
    console.error(error);
  }
}

loadApplyPage();
initFooter();
