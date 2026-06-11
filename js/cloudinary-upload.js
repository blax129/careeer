/**
 * Cloudinary direct browser uploads (unsigned preset only — never use API Secret client-side).
 * All application files are uploaded as "raw" resources.
 */

const CLOUDINARY_CLOUD_NAME = String(
  import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME || "dhrjlmfcp",
).trim();
const CLOUDINARY_UPLOAD_PRESET = String(
  import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET || "application_documents",
).trim();

const UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`;

const EXTENSION_BY_MIME = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "text/plain": ".txt",
};

function getFileExtension(file) {
  const match = String(file?.name || "")
    .toLowerCase()
    .match(/(\.[a-z0-9]+)$/i);
  if (match) {
    return match[1];
  }

  return EXTENSION_BY_MIME[file?.type] || ".bin";
}

/**
 * Renames uploads to a safe ASCII filename before sending to Cloudinary.
 * Applicants can pick any filename; this runs automatically and is invisible to them.
 */
export function prepareFileForUpload(file, prefix = "document") {
  const extension = getFileExtension(file);
  const safeName = `${prefix}-${Date.now()}${extension}`;

  if (file.name === safeName) {
    return file;
  }

  return new File([file], safeName, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

/** Only reject missing or empty files — no type, size, or filename restrictions. */
export function validateUploadFile(file) {
  if (!file) {
    return { valid: false, message: "Please select a file to upload." };
  }

  if (file.size === 0) {
    return { valid: false, message: "The selected file appears to be empty." };
  }

  return { valid: true };
}

/** @deprecated Use validateUploadFile */
export function validatePdfFile(file) {
  return validateUploadFile(file);
}

/** @deprecated Use validateUploadFile */
export function validateApplicationDocument(file) {
  return validateUploadFile(file);
}

/**
 * Upload a file directly to Cloudinary using an unsigned upload preset.
 * Uses XMLHttpRequest so upload progress can be reported to the UI.
 */
export async function uploadFileToCloudinary(file, { onProgress } = {}) {
  if (!file) {
    throw new Error("No file was provided for upload.");
  }

  const validation = validateUploadFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  return new Promise((resolve, reject) => {
    const uploadFile = prepareFileForUpload(file, "application");
    const formData = new FormData();
    formData.append("file", uploadFile);
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
      reject(
        new Error(
          cloudinaryError ||
            "We could not upload your file. Please try again or choose a different file.",
        ),
      );
    });

    xhr.addEventListener("error", () => {
      reject(
        new Error(
          "We could not upload your file. Please check your connection and try again.",
        ),
      );
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("File upload was cancelled."));
    });

    xhr.send(formData);
  });
}

/** @deprecated Use uploadFileToCloudinary */
export async function uploadPdfToCloudinary(file, options = {}) {
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
      documentUpload: null,
    });
  }

  const coverLetterFile = form.coverLetter?.files?.[0];
  if (coverLetterFile && !form.cover_letter_url?.value?.trim()) {
    queue.push({
      label: "cover letter",
      file: coverLetterFile,
      fieldName: "cover_letter_url",
      contextKey: "coverLetterUrl",
      documentUpload: null,
    });
  }

  const supportingFile = documentUpload?.getSelectedFile?.();
  if (supportingFile && !form.document_url?.value?.trim()) {
    queue.push({
      label: "supporting document",
      file: supportingFile,
      fieldName: "document_url",
      contextKey: "documentUrl",
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

    const validation = validateUploadFile(item.file);
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
