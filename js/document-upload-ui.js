import { uploadFileToCloudinary, validateUploadFile } from "./cloudinary-upload.js";

const UPLOAD_ICON = `
  <svg class="apply-document-upload__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M11 16V7.85l-2.6 2.6L7 9.05 12 4l5 5.05-1.4 1.4L13 7.85V16h-2zm-7 2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.18l1 2H4v10h16V6h-3.18l1-2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4z"/>
  </svg>
`;

/**
 * Renders the Supporting Documents section markup (inserted into apply form HTML).
 */
export function renderSupportingDocumentsSection() {
  return `
    <section class="apply-form__section">
      <h2 class="apply-form__section-title"><span class="apply-form__section-number">3.</span> Supporting Documents</h2>
      <p class="apply-form__section-intro">Upload a supporting document. This is optional and will be stored securely.</p>

      <div class="apply-form__field">
        <label class="apply-form__label" for="apply-document-input">Supporting document <span class="apply-form__optional">(optional)</span></label>

        <input
          class="apply-form__upload-input"
          id="apply-document-input"
          name="supportingDocument"
          type="file"
        >
        <input type="hidden" id="apply-document-url" name="document_url" value="">

        <div
          class="apply-document-upload"
          id="apply-document-dropzone"
          role="button"
          tabindex="0"
          aria-label="Upload supporting document"
        >
          ${UPLOAD_ICON}
          <p class="apply-document-upload__title">Drag and drop your file here</p>
          <p class="apply-document-upload__hint">or <span class="apply-document-upload__link">click to browse</span></p>
          <p class="apply-document-upload__meta">Any file type accepted</p>
        </div>

        <p class="apply-document-upload__filename" id="apply-document-filename" hidden></p>

        <div class="apply-document-upload__progress" id="apply-document-progress" hidden>
          <div class="apply-document-upload__progress-track" aria-hidden="true">
            <div class="apply-document-upload__progress-bar" id="apply-document-progress-bar"></div>
          </div>
          <p class="apply-document-upload__progress-text" id="apply-document-progress-text">Uploading… 0%</p>
        </div>

        <p class="apply-document-upload__status apply-document-upload__status--success" id="apply-document-success" hidden>
          Document uploaded successfully.
        </p>
        <p class="apply-document-upload__status apply-document-upload__status--error" id="apply-document-error" hidden></p>
      </div>
    </section>
  `;
}

function setDropzoneState(dropzone, state) {
  dropzone.classList.remove(
    "is-dragover",
    "is-selected",
    "is-uploading",
    "is-complete",
    "is-error",
  );

  if (state) {
    dropzone.classList.add(state);
  }
}

function resetUploadFeedback(elements) {
  const { progressEl, progressBar, progressText, successEl, errorEl } = elements;

  progressEl.hidden = true;
  progressBar.style.width = "0%";
  progressText.textContent = "Uploading… 0%";
  successEl.hidden = true;
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function showValidationError(elements, message) {
  const { errorEl, successEl } = elements;
  successEl.hidden = true;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

/**
 * Wires drag-and-drop, file selection, and UI feedback for the supporting document field.
 * Actual Cloudinary upload runs on form submit (see apply.js).
 */
export function initSupportingDocumentUpload(form) {
  const input = form.querySelector("#apply-document-input");
  const dropzone = form.querySelector("#apply-document-dropzone");
  const filenameEl = form.querySelector("#apply-document-filename");
  const documentUrlInput = form.querySelector("#apply-document-url");
  const progressEl = form.querySelector("#apply-document-progress");
  const progressBar = form.querySelector("#apply-document-progress-bar");
  const progressText = form.querySelector("#apply-document-progress-text");
  const successEl = form.querySelector("#apply-document-success");
  const errorEl = form.querySelector("#apply-document-error");

  if (!input || !dropzone || !documentUrlInput) {
    return null;
  }

  const elements = {
    input,
    dropzone,
    filenameEl,
    documentUrlInput,
    progressEl,
    progressBar,
    progressText,
    successEl,
    errorEl,
  };

  let selectedFile = null;

  function clearSelection() {
    selectedFile = null;
    input.value = "";
    documentUrlInput.value = "";
    filenameEl.hidden = true;
    filenameEl.textContent = "";
    setDropzoneState(dropzone, null);
    resetUploadFeedback(elements);
  }

  let uploadRequestId = 0;

  async function uploadSelectedFile(file) {
    const requestId = ++uploadRequestId;
    selectedFile = file;
    documentUrlInput.value = "";
    filenameEl.textContent = `Uploading: ${file.name}`;
    filenameEl.hidden = false;
    resetUploadFeedback(elements);
    setUploading(0);

    try {
      const secureUrl = await uploadFileToCloudinary(file, {
        onProgress: (percent) => {
          if (requestId === uploadRequestId) {
            setUploading(percent);
          }
        },
      });

      if (requestId !== uploadRequestId) {
        return false;
      }

      setUploadSuccess(secureUrl);
      filenameEl.textContent = `Uploaded: ${file.name}`;
      return true;
    } catch (error) {
      if (requestId !== uploadRequestId) {
        return false;
      }

      clearSelection();
      setUploadError(error?.message || "We could not upload that file. Please try again.");
      return false;
    }
  }

  function applySelectedFile(file) {
    const validation = validateUploadFile(file);
    if (!validation.valid) {
      clearSelection();
      showValidationError(elements, validation.message);
      setDropzoneState(dropzone, "is-error");
      return false;
    }

    void uploadSelectedFile(file);
    return true;
  }

  dropzone.addEventListener("click", () => input.click());

  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      clearSelection();
      return;
    }

    applySelectedFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      setDropzoneState(dropzone, selectedFile ? "is-selected" : "is-dragover");
    });
  });

  dropzone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    if (!dropzone.contains(event.relatedTarget)) {
      setDropzoneState(dropzone, selectedFile ? "is-selected" : null);
    }
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];

    if (!file) {
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    applySelectedFile(file);
  });

  return {
    getSelectedFile() {
      return selectedFile;
    },
    clearSelection,
    setUploading(percent = 0) {
      errorEl.hidden = true;
      successEl.hidden = true;
      progressEl.hidden = false;
      setDropzoneState(dropzone, "is-uploading");
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `Uploading… ${percent}%`;
    },
    setUploadSuccess(url) {
      documentUrlInput.value = url;
      progressEl.hidden = true;
      successEl.hidden = false;
      setDropzoneState(dropzone, "is-complete");
    },
    setUploadError(message) {
      documentUrlInput.value = "";
      progressEl.hidden = true;
      errorEl.textContent = message;
      errorEl.hidden = false;
      setDropzoneState(dropzone, "is-error");
    },
    resetUploadFeedback() {
      resetUploadFeedback(elements);
    },
  };
}
