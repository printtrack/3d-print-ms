---
title: "Customer portal & verification"
description: "How customers register, get verified and see orders, quotes and invoices in the portal"
route: "/portal/signin"
icon: "UserRound"
group: "Knowledge & Admin"
order: 7.5
---

# Customer portal & verification

Besides the public order form and the tracking page there is a **customer portal** where registered customers bundle their orders, approve quotes and retrieve invoices. This page explains the interplay from an admin perspective. Managing the customer records themselves is described under [[Customers|customers]].

![Customer portal sign-in](/wiki-screenshots/portal.png)

## Registration & sign-in

- Customers register themselves at `/portal/register`.
- After successful verification they sign in at `/portal/signin`.
- In the portal (`/portal`) they see their own orders, submit new orders via `/portal/orders/new` and track status.

## Verification modes

How newly registered customers are unlocked is set under [[Settings]] (**Company** area, field *Verification of newly registered customers*). There are three modes:

| Mode | Behaviour |
|------|-----------|
| **No verification** | Customers can order immediately — no extra step |
| **Manual by admin** | An admin unlocks each customer manually under [[Customers|customers]] |
| **By email confirmation** | The customer receives a confirmation link and verifies themselves |

Details on unlocking, resetting and re-sending the confirmation are under [[Customers|customers]].

> **Access code:** Optionally you can enable an **access code for the order form** in the same area. The public form is then only reachable with the code — useful for closed user groups.

## Approving quotes (customer view)

When you send a [[Quotes & Invoices|billing]] quote, the customer sees it in the portal or via their tracking link:

- All line items with quantities, unit prices and total; estimate items are marked as such (with a note that the final amount may still change).
- **Approve** and **Reject** buttons (rejection includes a reason field).
- Download of the quote PDF.

The customer's decision immediately sets the quote status in the admin to `Approved` or `Rejected` and — on approval — unlocks invoice creation.

## Retrieving invoices (customer view)

Issued invoices also appear in the portal. The customer sees amount, due date and payment status and can download the **invoice PDF** (token-protected). Dunning notices and payment reminders are delivered automatically by email (see [[Quotes & Invoices|billing]]).

## Interplay with orders

- An order can be linked to a customer record — this bundles several orders in the customer's portal.
- The customer's email language determines the language of automatic notifications, quotes and invoices.
