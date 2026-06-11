# Partner handoff — Email 2 + payment page

Copy everything below the line into Claude for your partner.

---

## Message for partner's AI

My careers site now sends a **full onboarding package** to our Google Apps Script when someone applies. I need you to finish **Email 2** and deploy the **payment page**.

### What the careers site already does

1. Applicant submits the apply form.
2. **Email 1** sends immediately via EmailJS ("Application Received").
3. If Email 1 succeeds, the site POSTs JSON to our Apps Script URL:
   `https://script.google.com/macros/s/AKfycbxHATyBoGmfaWeNnx6Q42EK6sIVGrakQ5TX7ZOlUgGWpT4XVaS7HNr653Q1bHeHL6p1/exec`

### POST body (full payload)

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "catering_coordinator",
  "applicationId": "APP-1712345678901",
  "jobId": "302769",
  "jobTitle": "Catering Coordinator, Match Day Only",
  "jobLocation": "Mercedes-Benz Stadium, 1 AMB Drive NW, Atlanta, GA 30313 (Atlanta host city)",
  "hostCity": "Atlanta",
  "stadiumName": "Mercedes-Benz Stadium",
  "stadiumAddress": "1 AMB Drive NW, Atlanta, GA 30313",
  "reportingDateLabel": "Sunday, 15 June 2026",
  "reportingTimeLabel": "8:00 AM",
  "reportingInstruction": "Please report to the reception desk at Mercedes-Benz Stadium...",
  "reportingSource": "match_day",
  "fees": {
    "hourlyRate": 28,
    "payLabel": "$225 / match day",
    "compulsoryTotal": 102,
    "depositTotal": 20,
    "grandTotal": 122,
    "compulsoryTotalLabel": "$102.00",
    "depositTotalLabel": "$20.00",
    "grandTotalLabel": "$122.00",
    "paymentExplanation": "These compulsory fees cover tournament onboarding...",
    "items": [
      { "id": "admin", "label": "Staff registration & admin fee", "description": "Onboarding, ID card, lanyard, and contract processing", "amount": 30, "amountLabel": "$30.00", "isDeposit": false },
      { "id": "background", "label": "Background check & security clearance", "description": "Mandatory for all tournament operations personnel", "amount": 25, "amountLabel": "$25.00", "isDeposit": false },
      { "id": "medical", "label": "Medical screening", "description": "Required for event insurance compliance", "amount": 20, "amountLabel": "$20.00", "isDeposit": false },
      { "id": "training", "label": "Tournament operations training", "description": "Venue procedures, coordination systems, and emergency protocols", "amount": 22, "amountLabel": "$22.00", "isDeposit": false },
      { "id": "uniform", "label": "Uniform kit deposit", "description": "Returnable at end of event — deposit refunded on return", "amount": 20, "amountLabel": "$20.00 deposit", "isDeposit": true }
    ]
  },
  "paymentExplanation": "These compulsory fees cover tournament onboarding...",
  "paymentUrl": "https://imaginative-bonbon-f200da.netlify.app/?d=BASE64_PAYLOAD",
  "approvedAtIso": "2026-06-05T12:00:00.000Z"
}
```

**Important:** Fee amounts and line items are **calculated per role and salary** on the careers site. Do not hardcode $120 for everyone — use the `fees` object from the POST.

**Reporting dates** are set to the **next stadium match day** at least 2 days after approval (from FIFA WC26 schedule). Fallback: approval date + 2 days.

### Your tasks

#### 1. Google Apps Script (Email 2)

Use the reference file I was given: `scripts/google-apps-script-followup.js`

- `doPost` stores the full payload
- Wait **4 hours**, then send Email 2 via `GmailApp.sendEmail`
- Email must include:
  - Congratulations / approved message
  - Application ID in a screenshot box
  - Reporting date, time, stadium address
  - Fee breakdown from `fees.items`
  - Total due
  - Button: **"I am ready to make this payment"** → `paymentUrl` from payload (or rebuild from `/?d=BASE64`)

Set a time-driven trigger on `sendDueFollowUpEmails` (every hour).

#### 2. Payment page (Netlify)

Deploy to: `https://imaginative-bonbon-f200da.netlify.app` (index.html at root)

Reference implementation is in the careers repo:
- `payment.html`
- `js/payment.js`
- `css/styles.css` (payment section)

The page reads `?d=` (base64 JSON payload) and shows:
- Application ID (screenshot section)
- Reporting details
- Role-specific fee breakdown
- **Chime** section — leave blank placeholder for now (I will add Chime details later)
- **Credit / Debit Card** (Visa, Mastercard, Verve) — show **"Under maintenance"** always for now
- Button: "I am ready to make this payment" (disabled until Chime details are added via `window.setChimePaymentDetails(html)`)

When Chime info is ready, call:
```javascript
window.setChimePaymentDetails('<p>Pay $122.00 to <strong>$ChimeTag</strong></p>');
```

#### 3. Environment variables (partner payment site only)

```
VITE_PAYMENT_PAGE_URL=https://imaginative-bonbon-f200da.netlify.app
```

**Do NOT** put the payment URL in `VITE_FOLLOWUP_SCRIPT_URL` on the careers site — that must stay the Google Apps Script `/exec` URL.

### Email 2 flow summary

```
Apply → Email 1 (immediate) → POST to Apps Script → wait 4h → Email 2 (approved + fees + payment link) → Payment page (Chime)
```

### Files to copy from careers repo

| File | Purpose |
|------|---------|
| `scripts/google-apps-script-followup.js` | Complete Apps Script |
| `payment.html` + `js/payment.js` | Payment page for Netlify |
| `email-templates/application-approved.html` | Email 2 design reference |
| `css/styles.css` | Payment page styles (`.payment-*` classes) |
