/**
 * Cloudinary direct browser uploads (unsigned preset only — never use API Secret client-side).
 * All application files are uploaded as "raw" resources so PDFs and Word docs keep working links.
 */

const CLOUDINARY_CLOUD_NAME = String(
  import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME || "dhrjlmfcp",
).trim();
const CLOUDINARY_UPLOAD_PRESET = String(
  import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET || "application_documents",
).trim();

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const DOC_MIME = "application/msword";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`;

const APPLICATION_EXTENSIONS = [".pdf", ".doc", ".docx"];
const APPLICATION_MIMES = new Set([PDF_MIME, DOC_MIME, DOCX_MIME, ""]);

function getFileExtension(file) {
  return String(file?.name || "").toLowerCase().replace(/.*(\.[^.]+)$/, "$1");
}

function isPdfFile(file) {
  const name = String(file.name || "").toLowerCase();
  return file.type === PDF_MIME || name.endsWith(".pdf");
}

function isApplicationDocument(file) {
  const extension = getFileExtension(file);
  return APPLICATION_EXTENSIONS.includes(extension) || APPLICATION_MIMES.has(file.type);
}

function validateFileSize(file) {
  if (file.size > MAX_FILE_BYTES) {
    return {
      valid: false,
      message: "This file is too large. Maximum allowed size is 10 MB.",
    };
  }

  if (file.size === 0) {
    return { valid: false, message: "The selected file appears to be empty." };
  }

  return { valid: true };
}

/**
 * Validation for the Supporting Documents section (PDF only).
 */
export function validatePdfFile(file) {
  if (!file) {
    return { valid: false, message: "Please select a PDF document to upload." };
  }

  if (!isPdfFile(file)) {
    return {
      valid: false,
      message: "Only PDF files are accepted. Please choose a .pdf document.",
    };
  }

  return validateFileSize(file);
}

/**
 * Validation for résumé / CV and cover letter fields (.pdf, .doc, .docx).
 */
export function validateApplicationDocument(file) {
  if (!file) {
    return { valid: false, message: "Please select a document to upload." };
  }

  if (!isApplicationDocument(file)) {
    return {
      valid: false,
      message: "Only PDF and Word documents (.pdf, .doc, .docx) are accepted.",
    };
  }

  return validateFileSize(file);
}

/**
 * Upload a file directly to Cloudinary using an unsigned upload preset.
 * Uses XMLHttpRequest so upload progress can be reported to the UI.
 */
export async function uploadFileToCloudinary(file, { onProgress } = {}) {
  if (!file) {
    throw new Error("No file was provided for upload.");
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_ENDPOINT);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || typeof onProgress !== "function") {
        return;
      }

      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(percent);
    });

    xhr.addEventListener("load", () => {
      let payload = null;

      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.secure_url) {
        resolve(payload.secure_url);
        return;
      }

      const cloudinaryError =
        payload?.error?.message || payload?.message || "Cloudinary rejected the upload.";
      reject(new Error(cloudinaryError));
    });

    xhr.addEventListener("error", () => {
      reject(
        new Error(
          "We could not upload your document. Please check your connection and try again.",
        ),
      );
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Document upload was cancelled."));
    });

    xhr.send(formData);
  });
}

/** @deprecated Use uploadFileToCloudinary — kept for existing imports. */
export async function uploadPdfToCloudinary(file, options = {}) {
  const validation = validatePdfFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  return uploadFileToCloudinary(file, options);
}

/**
 * Upload all selected application files to Cloudinary before Formspree submission.
 * Formspree receives URLs only — no binary file attachments.
 */
export async function uploadApplicationFiles(form, context, { documentUpload, onStatus } = {}) {
  const queue = [];

  const cvFile = form.cv?.files?.[0];
  if (cvFile && !form.cv_url?.value?.trim()) {
    queue.push({
      label: "résumé",
      file: cvFile,
      fieldName: "cv_url",
      contextKey: "cvUrl",
      validate: validateApplicationDocument,
    });
  }

  const coverLetterFile = form.coverLetter?.files?.[0];
  if (coverLetterFile && !form.cover_letter_url?.value?.trim()) {
    queue.push({
      label: "cover letter",
      file: coverLetterFile,
      fieldName: "cover_letter_url",
      contextKey: "coverLetterUrl",
      validate: validateApplicationDocument,
    });
  }

  const supportingFile = documentUpload?.getSelectedFile?.();
  if (supportingFile && !form.document_url?.value?.trim()) {
    queue.push({
      label: "supporting document",
      file: supportingFile,
      fieldName: "document_url",
      contextKey: "documentUrl",
      validate: validatePdfFile,
      documentUpload,
    });
  }

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    const stepLabel =
      queue.length > 1
        ? `Uploading ${item.label} (${index + 1} of ${queue.length})...`
        : `Uploading ${item.label}...`;

    onStatus?.(stepLabel);

    const validation = item.validate(item.file);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const secureUrl = await uploadFileToCloudinary(item.file, {
      onProgress: (percent) => {
        item.documentUpload?.setUploading(percent);
      },
    });

    if (form[item.fieldName]) {
      form[item.fieldName].value = secureUrl;
    }

    context[item.contextKey] = secureUrl;
    item.documentUpload?.setUploadSuccess(secureUrl);
  }

  return context;
}
