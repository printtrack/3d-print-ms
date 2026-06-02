---
title: "Settings → Billing & Documents"
description: "Configure billing rules (quote approval, payment term, dunning) and document templates (company data, tax, bank, number ranges)"
route: "/admin/settings?tab=abrechnung"
icon: "Scale"
group: "Knowledge & Admin"
order: 9.5
---

# Billing & Documents

The foundations for [[Quotes & Invoices|billing]] are configured in two areas of the [[Settings]]: **Billing** (rules & flows) and **Documents** (appearance & master data of the PDFs). Both are **admin only**.

![Settings Billing](/wiki-screenshots/settings-billing.png)

---

## Area: Billing

Controls how the billing workflow behaves.

### Charging rules

| Setting | Effect |
|---------|--------|
| **Charge misprints** | Whether failed prints (misprint parts) are billed to the customer |
| **Charge prototypes** | Whether prototype iterations are billed |

### Quote approval

| Setting | Effect |
|---------|--------|
| **Approval required** | When active, the customer must approve a quote before production/billing (works together with the **Quote approved** gate, see [[Settings → Phases|settings-phases]]) |
| **Minimum amount for approval (€)** | Approval is only required from this amount up — small orders skip the approval step |

### Payment term

- **Payment term (days)** — how many days after issuing an invoice the due date is set.

### Dunning

Enable **Enable reminders** to switch on the automatic, staggered dunning run. Timings and fees are freely configurable:

| Setting | Default | Meaning |
|---------|---------|---------|
| **Pre-due (days)** | 3 | A friendly reminder goes out this many days **before** the due date |
| **Reminder (days after due)** | 7 | First payment reminder after the due date (no fee) |
| **1st dunning (days)** | 21 | First dunning notice |
| **2nd dunning (days)** | 42 | Second dunning notice |
| **Fee 1st dunning (€)** | 5.00 | Dunning fee added to the 1st notice |
| **Fee 2nd dunning (€)** | 10.00 | Dunning fee of the 2nd notice |

> The associated email texts (pre-due, reminder, 1st/2nd dunning) are maintained in both languages under [[Settings → Email templates|settings-email]].

---

## Area: Documents

Defines the appearance and master data of quote and invoice PDFs.

### Logo

Upload a company logo. It appears in the header of every document.

### Company data

| Field | Description |
|-------|-------------|
| **Company name** | Overrides the general company name specifically for documents |
| **Street & number**, **Address line 2** | Address in the document header |
| **Postcode/City**, **Country** | Remaining address |

### Tax

| Field | Description |
|-------|-------------|
| **Small-business scheme (§19 UStG)** | When active, invoices show **no VAT** and carry the §19 note |
| **VAT ID** | VAT identification number |
| **Tax number (fallback)** | Used when no VAT ID is available |
| **Default VAT rate (%)** | Prefills the tax rate of new quote items |

### Bank details

**Bank name**, **IBAN** and **BIC** — appear as payment information on the invoice.

### Styling

| Field | Description |
|-------|-------------|
| **Accent color (HEX)** | Accent color of the documents (with live preview) |
| **Footer text (German / English)** | Footer at the end of the document, per language |

### Number ranges

| Field | Description |
|-------|-------------|
| **Quote prefix** | Prefix of quote numbers (e.g. `AN-`) |
| **Invoice prefix** | Prefix of invoice numbers (e.g. `RE-`) |

Numbers are assigned **sequentially** when a quote is sent or an invoice is issued, and cannot be changed afterwards (audit-proof).

---

All changes take effect immediately after clicking **Save**. The actual billing flow is described under [[Quotes & Invoices|billing]].
