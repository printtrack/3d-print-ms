---
title: "Quotes & Invoices"
description: "Billing an order: create and send a quote, approval, issue an invoice, payments, dunning reminders and cancellation"
icon: "Receipt"
group: "Orders & Production"
order: 2.4
---

# Quotes & Invoices

The complete billing of an order happens right inside the [[Order detail view|orders-detail]] — in the right-hand sidebar. It follows a fixed sequence:

**Quote** → customer approves → **Invoice** → **Payment** → optionally **Reminder** or **Cancellation**

![Billing area in the order detail view](/wiki-screenshots/billing.png)

> The base settings (company data on documents, tax/small-business scheme, bank details, number ranges, payment term and dunning reminders) are configured once under [[Settings → Billing & Documents|settings-billing]].

---

## 1. Quote

The quote is the first stage. It records the expected cost and is sent to the customer for approval.

### Create a quote

1. In the quote card click **Create quote** — an empty **draft** is created (status `Draft`).
2. The edit dialog opens automatically.

![Quote editor with line items](/wiki-screenshots/billing-quote.png)

### Add line items

Each row in the quote is a **line item** with these fields:

| Field | Description |
|-------|-------------|
| **Description** | Name of the item (required before sending) |
| **Quantity** | Amount (decimals allowed, e.g. material weight) |
| **Unit price** | Net price per unit in euros |
| **Tax** | Tax rate in percent (default 19 %) |
| **Category** | Filament, hardware, post-processing, design, shipping, discount, other |
| **Source** | Estimate, fixed or actual (see below) |

**Item source** controls how binding a price is:

- **Estimate** — a provisional value that may still change before the invoice. Estimate rows without a price get a ⚠️ marker as a reminder.
- **Fixed** — a firmly committed amount.
- **Actual** — the value actually incurred (e.g. filament measured after printing).

### Pull items from parts

Via **From parts** (wand icon) the editor automatically pulls estimate items from the order's actual [[parts|orders-detail]] iterations. This saves you from typing filament and material items by hand. You can run it as often as you like; existing items are not duplicated.

### Save, Send, Delete

In draft mode three actions are available:

- **Save** — store changes, the quote stays a draft.
- **Send** — saves and emails the quote to the customer (with a PDF attachment). Status changes to `Sent`. A **verification request** (`VerificationRequest`) is created automatically. Sending is only possible when at least one item has a description.
- **Delete** — discards the draft entirely (only possible while in draft status).

Optionally you can set a **valid-until date** and **notes** (which appear on the PDF).

### Customer approval

After sending, the customer opens the quote via their tracking link or in the [[Customer portal & verification|portal]] and can **approve** or **reject** it:

- **Approved** — status turns green, the invoice can be created.
- **Rejected** — the customer's rejection reason is shown in red in the quote card.

### Quote statuses at a glance

| Status | Meaning |
|--------|---------|
| `Draft` | Still being edited, customer sees nothing |
| `Sent` | Sent to customer, awaiting approval |
| `Approved` | Customer agreed → invoice possible |
| `Rejected` | Customer rejected (with reason) |
| `Expired` | Valid-until date passed |
| `Superseded` | Replaced by a newer version |

### New version

As long as a quote is not approved, you can create a revised version via **New version**. It is created as a copy of the previous quote; the old version is set to `Superseded`. The version number (`v2`, `v3`, …) appears in the status badge.

---

## 2. Invoice

An invoice can only originate from an **approved quote**. If no quote is approved yet, the invoice card points this out.

### Create an invoice draft

In the invoice card click **Create invoice**. A draft invoice is created from the approved quote with all its items.

### Review before issuing (diff view)

Clicking **Review & issue** opens a **comparison dialog** that lines up quote and invoice item by item:

- **Estimate items** whose value changed are highlighted in amber (old value struck through → new value).
- A totals row shows the difference (Δ) between quote and invoice.
- This lets you see — before issuing — where the invoice deviates from the original estimate.

### Issue

**Issuing** does the following irreversibly:

1. The invoice gets a sequential **invoice number** (number range from [[Settings → Billing & Documents|settings-billing]]).
2. The **PDF is rendered and archived** (audit-proof — later changes to the document are no longer possible).
3. The invoice is emailed to the customer.
4. Status changes from `Draft` to `Issued`, and a **due date** is set based on the payment term.

> A draft can be deleted at any time before issuing via the trash icon.

### Invoice statuses at a glance

| Status | Meaning |
|--------|---------|
| `Draft` | Not yet issued, no number |
| `Issued` | Sent, awaiting payment |
| `Partially paid` | First payment recorded, balance outstanding |
| `Paid` | Fully settled |
| `Overdue` | Due date passed, not (fully) paid |
| `Cancelled` | Reversed by a cancellation invoice |

---

## 3. Payments

For issued invoices (`Issued`, `Partially paid`, `Overdue`) you record incoming payments via **Record payment**.

### Record a payment

1. Enter the amount (prefilled with the outstanding balance) and payment date.
2. Choose the **payment method**: SEPA, cash, card, PayPal, credit or other.
3. Optionally add a reference (e.g. payment purpose) and an internal note.
4. **Record**.

### Partial payments

You can record several partial payments. The invoice card then shows a **progress bar** and the remaining balance. As soon as the sum reaches the invoice total, the status automatically flips to `Paid`.

### Customer credit

If the customer has a credit balance (e.g. from a credit note), the payment dialog shows a green **credit quick action**. One click applies the matching amount and sets the payment method to `Credit`.

### Remove a payment

A payment recorded by mistake can be removed again (**admin only**); the invoice status is recalculated automatically.

---

## 4. Reminders (automatic)

When dunning reminders are enabled in [[Settings → Billing & Documents|settings-billing]], the system automatically sends staggered reminders. Each stage is sent **only once per invoice**.

| Stage | Timing (default) | Content |
|-------|------------------|---------|
| Pre-due | 3 days **before** due date | Friendly reminder |
| 1st reminder | 7 days **after** due date | Payment reminder (no fee) |
| 1st dunning | 21 days after due date | Dunning notice with optional fee (default €5) |
| 2nd dunning | 42 days after due date | Dunning notice with optional fee (default €10) |

Delivery runs via a **sweep** triggered whenever an order detail page loads and via `POST /api/admin/invoices/auto-transition`. The same sweep automatically flips overdue invoices to `Overdue` and completes fully-paid orders.

---

## 5. Cancellation (storno)

An already-issued invoice cannot be deleted but can be **cancelled** (click the ✕ icon in the invoice card):

- A **cancellation invoice** is created — a negative twin of the original (same items, negative amounts).
- The original invoice is set to `Cancelled` (shown struck through).
- Both documents are retained for audit reasons.

---

## PDFs

- You can open the **quote PDF** and **invoice PDF** anytime via the **PDF** button in the respective card.
- For the team the PDFs are auth-protected; the customer reaches their documents token-protected via the tracking link or the [[Customer portal & verification|portal]].
- The appearance (logo, company data, accent color, footer) is configured under [[Settings → Billing & Documents|settings-billing]].

## History

All billing events (quote created/sent, invoice issued/cancelled, payment recorded/removed, reminder sent) appear in the **History** tab of the [[Order detail view|orders-detail]] activity area.
