/**
 * Site configuration with production fallbacks.
 * EmailJS public key, service ID, and template ID are client-safe values.
 * Env vars (VITE_*) override these when present at build time.
 */

function env(name, fallback = "") {
  const value = String(import.meta.env?.[name] || "").trim();
  return value || fallback;
}

export const EMAILJS_PUBLIC_KEY = env("VITE_EMAILJS_PUBLIC_KEY", "F34PJBkDeDBtVEddl");
export const EMAILJS_SERVICE_ID = env("VITE_EMAILJS_SERVICE_ID", "service_7s6hkrw");
export const EMAILJS_TEMPLATE_ID = env("VITE_EMAILJS_TEMPLATE_ID", "template_x50eqr7");
export const COMPANY_NAME = env("VITE_COMPANY_NAME", "FIFA Careers");
export const COMPANY_LOGO_URL = env(
  "VITE_COMPANY_LOGO_URL",
  "https://res.cloudinary.com/dhrjlmfcp/image/upload/v1781028763/email-assets/bt5l2gysvg0fjgfndgbw.png",
);
export const SITE_URL = env("VITE_SITE_URL", "");
export const FOLLOWUP_SCRIPT_URL = env(
  "VITE_FOLLOWUP_SCRIPT_URL",
  "https://script.google.com/macros/s/AKfycbxHATyBoGmfaWeNnx6Q42EK6sIVGrakQ5TX7ZOlUgGWpT4XVaS7HNr653Q1bHeHL6p1/exec",
);
export const PAYMENT_PAGE_URL = env(
  "VITE_PAYMENT_PAGE_URL",
  "https://imaginative-bonbon-f200da.netlify.app",
);
export const LOGO_PATH = "/images/logo.png";
