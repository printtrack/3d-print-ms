---
title: "Settings"
description: "System configuration: company data, email templates, phases, team and machines (admin only)"
route: "/admin/settings"
icon: "SlidersHorizontal"
group: "Knowledge & Admin"
order: 9
---

# Settings

The Settings area is **admin-only**. This is where you configure the entire system. The page is organized into tabs.

![Settings overview](/wiki-screenshots/settings.png)

## Tab overview

| Tab | Content |
|-----|---------|
| **Company** | Company name, contact email, access code and customer verification |
| **Order intake** | Who may submit which order types, and how customer accounts are created (invitations → [[Customers\|customers]]) |
| **Billing** | Quote approval, payment term and dunning → [[Settings → Billing & Documents|settings-billing]] |
| **Documents** | Appearance and master data of quote/invoice PDFs → [[Settings → Billing & Documents|settings-billing]] |
| **Legal** | Imprint and privacy policy |
| **Emails** | Automatic phase notifications → [[Settings → Email templates|settings-email]] |
| **Survey** | Customer satisfaction survey configuration |
| **Customer timeline** | Which events customers see in the tracking timeline |
| **Phases** | Manage order phases → [[Settings → Phases|settings-phases]] |
| **Part phases** | Manage phases for individual parts → [[Settings → Phases|settings-phases]] |
| **Project phases** | Manage phases for projects → [[Settings → Phases|settings-phases]] |
| **Project file phases** | Dedicated phases for project files (e.g. Draft → In Review → Final) → [[Projects\|projects]] |
| **Machines** | Add and configure 3D printers → [[Settings → Machines|settings-machines]] |

> Team management is no longer a settings section but its own page: [[Team]] (sidebar → "Knowledge & Admin").

## Company data (Tab: Company)

- **Company name** — shown in the sidebar navigation and in outgoing emails
- **Contact email** — sender address for all automated system emails
- **Access code for the order form** — optional code without which the public order form is inaccessible (for closed user groups)
- **Verification of newly registered customers** — controls how portal customers are unlocked (none / manual by admin / by email confirmation) → [[Customer portal & verification|portal]]

Changes take effect immediately after clicking **Save**.

## Customer timeline (Tab: Customer timeline)

On the public tracking page, customers see a **timeline** of their order's key events — visually prepared with an icon, color and a readable label (e.g. "Quote sent" instead of a technical code).

Here you control **which** events customers see:

- **Show timeline in tracking** — master switch. When off, the whole timeline card is hidden.
- **Individual events** — grouped (Status & progress, Files, Approvals & design review, Billing, Survey), each event can be toggled on or off individually.

Important:

- **Internal activity is never sent to customers** — team assignments, print jobs, internal comments, part phase changes and price changes never appear in the customer timeline, regardless of the switches. Filtering happens server-side, so this data never reaches the customer's browser.
- **Billing events** (quote sent, invoice issued, payment received, invoice cancelled) are **off by default**, since quotes and invoices already appear as their own cards in tracking. Enable them individually if needed.

## Modules (Tab: Module)

Under **Feature scope → Modules** you decide which features the system loads, tailoring the product to your shop — e.g. "quotes only, no invoices", or a shop with no knowledge base at all.

- Each module has its own switch. **Default: everything on** — the full feature scope is available until you turn something off.
- Disabled modules disappear from the navigation and become unreachable (visiting the address directly redirects back to the overview).
- **Invoices** require the **Quotes** module — when quotes are off, invoices are disabled automatically and the switch is greyed out.
- Toggleable modules include: Quotes, Invoices, Print Jobs, Projects, Planning, Inventory, Knowledge Base, Customer Portal, Order Tracking, Survey and Customer Timeline.

## Brand (Tab: Marke)

The **Brand** tab white-labels the whole application — admin, landing page, customer portal
and tracking all follow the same look.

- **Accent color** — the app-wide brand color (default: amber). Enter a HEX value (e.g.
  `#2563eb`) or any CSS color; a color picker is provided. Empty = default.
- **Own logo** — shown in the sidebar and on documents (shared with the document logo).
  JPG, PNG or SVG, max 1 MB.
- **Favicon** — the browser tab icon (PNG, SVG or ICO).
- The **app title** (browser tab) follows the company name from the "Company" tab.

## Order intake (Tab: Auftragsannahme)

This is where you decide **through which channels orders arrive** — per channel, so you can e.g.
accept design orders from known customers only.

### Order types per channel

Two channels with two switches each (print orders / design orders):

- **Without an account (public form)** — what visitors can submit through the landing page
  without signing in.
- **With a customer account (portal)** — what signed-in customers can submit in the portal.

That covers the common setups:

| Goal | Setting |
|------|---------|
| Everything open to everyone (default) | all four switches on |
| **Design only with an account** | public: print only · portal: print & design |
| Public design only (e.g. a pure design studio) | public: design only |
| **Orders only with an account** | both public switches off |

If no type is left for a channel, that channel is closed: the landing page replaces the form with
a notice linking to the customer portal, and the portal hides its "New order" button. With **all
four** switches off the page warns you — nobody can submit an order at all then.

The rules are not just cosmetic: on every order the API resolves which channel is in use
(signed in = portal, otherwise public) and rejects order types that channel does not accept.
Bypassing the form gets you nowhere.

> The former "Show order type" switch on the order form has been folded into this. Existing
> installations that had switched it off behave exactly as before (public: print only) until you
> touch the switches here.

### Customer accounts & invitations

**Registration** controls how new customer accounts come into existence:

- **Open** — anyone can create an account themselves.
- **Invitation only** — an account can only be created from an invitation link. Without a valid
  invitation the registration page shows nothing but a notice, and the "Register now" link on the
  sign-in page disappears.
- **Closed** — no new accounts. Existing customers can still sign in.

This only decides **how** accounts come about. You invite individual customers where you manage
them anyway: [[Customers|customers]] → Invitations.

## Order form (Tab: Auftragsformular)

Here you can **configure the order form** customers use on the landing page to submit a print
job — tailored to your shop's intake. Which order types are on offer is decided under
[Order intake](#order-intake-tab-order-intake).

- **Fields** — the desired date can be shown/hidden and made mandatory. Name, email and
  description are always required.
- **Files** — allowed formats (a subset of JPG, PNG, GIF, WEBP, STL, OBJ, 3MF), maximum file
  size (MB) and maximum number of files (0 = unlimited). The limits are enforced server-side too.
- **Intro & consent** — an optional intro text above the form plus a mandatory consent checkbox
  before submitting, each in German and English.

## Legal (Tab: Legal)

Enter imprint and privacy policy text. These appear on the public pages (`/legal/impressum`, `/legal/datenschutz`).

## Sub-pages

- [[Settings → Billing & Documents|settings-billing]] — billing rules, dunning and document templates
- [[Settings → Email templates|settings-email]] — configure automatic customer notifications
- [[Settings → Phases|settings-phases]] — order phases, part phases and project phases
- [[Team]] — manage team members (its own page under "Knowledge & Admin")
- [[Settings → Machines|settings-machines]] — add 3D printers
