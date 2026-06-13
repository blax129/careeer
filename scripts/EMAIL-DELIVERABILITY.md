# Fix Email 2 going to spam

Email 2 is the delayed approval email sent from Google Apps Script. If it lands in spam, use the steps below in order.

## Why GmailApp often goes to spam

`GmailApp.sendEmail()` sends from the script owner's Gmail/Workspace account. Filters flag it when:

1. **Display name mismatch** — shows "FIFA Careers" but sends from `someone@gmail.com`
2. **Payment + approval language** — "approved", fees, payment links trigger filters
3. **Unknown Netlify link** — `imaginative-bonbon-f200da.netlify.app` looks unrelated to the sender
4. **Automated bulk sends** — time-driven triggers from personal Gmail look like spam
5. **No domain authentication** — free Gmail has weak SPF/DKIM alignment for branded mail

## Best fix (recommended): send Email 2 through EmailJS

Email 1 already uses EmailJS and usually reaches the inbox. Use the **same EmailJS account** for Email 2.

### Partner setup checklist

1. In EmailJS dashboard, create a **second template** for approval (copy from `email-templates/application-approved.html`).
   - Template **To email**: `{{to_email}}`
   - Subject: `Next steps for your FIFA World Cup 2026 application`
   - Body: use `{{{message_html}}}` or individual variables from the script

2. EmailJS → **Account → Security**:
   - Enable **"Allow EmailJS API for non-browser applications"**
   - Copy the **Private Key** (access token)

3. Google Apps Script → **Project Settings → Script properties**:
   - Add `EMAILJS_PRIVATE_KEY` = (private key from step 2)

4. In `scripts/google-apps-script-followup.js`:
   - Set `EMAIL_SENDER = "emailjs"`
   - Set `EMAILJS_APPROVAL_TEMPLATE_ID` to the new template ID

5. In EmailJS → **Email Services**, use the same connected service as Email 1 (Gmail/Outlook with a real inbox you monitor).

6. Add your careers site + payment site domains to EmailJS **Security → Allowed origins** if needed.

## Email 2 via EmailJS still goes to spam

Email 2 has payment links and fees — filters flag it more than Email 1 even when both use EmailJS.

### EmailJS template `template_ww0808o` settings

1. **To email:** `{{to_email}}`
2. **From name:** `{{from_name}}` or fixed `FIFA Careers`
3. **Reply To:** `{{reply_to}}` → `support@fifa26recruitment.com`
4. **Subject:** `{{email_subject}}` (script sends a softer subject — do not hardcode "offer" in the template)
5. **Body:** `{{{message_html}}}`

### EmailJS → Email Services → `service_scveg1v`

- Connected account must send from **`support@fifa26recruitment.com`** (or another `@fifa26recruitment.com` address), not a personal Gmail.
- In Zoho Mail: verify **SPF** and **DKIM** for `fifa26recruitment.com` (same domain as Brevo DKIM).

### After updating Apps Script

Paste latest `Apps Script.js`, deploy new version. Script version should be `2026-06-13-emailjs-deliverability`.

### Ask applicants once

First time: "Check spam and mark **Not spam**" — improves future delivery to that inbox.


Only viable with **Google Workspace** on a **custom domain** (not free `@gmail.com`).

### DNS (domain registrar)

| Record | Purpose |
|--------|---------|
| **SPF** | Authorize Google to send for your domain |
| **DKIM** | Google Admin → Apps → Google Workspace → Gmail → Authenticate email |
| **DMARC** | `v=DMARC1; p=none; rua=mailto:you@yourdomain.com` (start with `p=none`, tighten later) |

### Sending habits

- Send from `recruitment@yourdomain.com`, not personal Gmail
- Keep **From name** aligned with the address (e.g. "FIFA Careers Recruitment")
- Set **replyTo** to a monitored inbox
- Send low volume at first (warm up the address)
- Avoid ALL CAPS subjects and multiple exclamation marks

### Content changes that help

- Subject: `Next steps for your FIFA World Cup 2026 application` (less spammy than "APPROVED!!!")
- Include a plain-text version (script already does)
- One clear CTA button, not many links
- Host payment page on a domain that matches your brand if possible (custom domain on Netlify)

## Quick test

1. Send a test Email 2 to Gmail, Outlook, and Yahoo addresses
2. Check **Show original** in Gmail → look for `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`
3. Use https://www.mail-tester.com — aim for 8/10 or higher

## Message for partner's AI

```
Email 2 from Google Apps Script is going to spam. Switch from GmailApp to EmailJS for Email 2.

1. Create EmailJS template from email-templates/application-approved.html (To: {{to_email}})
2. EmailJS → Security → enable API for non-browser apps → copy Private Key
3. Apps Script → Script properties → EMAILJS_PRIVATE_KEY
4. Set EMAIL_SENDER = "emailjs" and EMAILJS_APPROVAL_TEMPLATE_ID in google-apps-script-followup.js
5. Use same EmailJS service as Email 1
6. Change subject to: "Next steps for your FIFA World Cup 2026 application"

If we must use Gmail: Google Workspace custom domain + SPF/DKIM/DMARC required. Free Gmail will keep hitting spam for payment/approval emails.
```
