# Email logo

**`logo.png`** — same FIFA logo used in the site header (170×60 PNG).

Used in two ways:

1. **EmailJS (active)** — `VITE_COMPANY_LOGO_URL` in `.env` points to the Cloudinary copy (public HTTPS, works in all inboxes).
2. **Self-hosted (optional)** — after deploy, also available at `/images/logo.png` if you set `VITE_SITE_URL` and remove `VITE_COMPANY_LOGO_URL`.

To use a different logo:

1. Replace `logo.png` in this folder.
2. Re-upload to Cloudinary (or update `VITE_COMPANY_LOGO_URL` in `.env`).
3. Restart `npm run dev` or run `npm run build`.
