---
title: "Customers"
description: "Manage customer data and email verification (admin only)"
route: "/admin/customers"
icon: "Users2"
group: "Knowledge & Admin"
order: 8
---

# Customers

The customers area is **visible to admins only**. Here you manage customers who have registered via the customer portal.

![Customers overview](/wiki-screenshots/customers.png)

## Customer list

The list shows all registered customers with:

- **Name and email**
- **Registration date**
- **Verification status** — whether the email address has been confirmed

## Email verification

If a customer hasn't received their confirmation email, you can:

1. **Set verification manually** — click the checkmark icon next to the customer. The email is marked as verified without any action from the customer.
2. **Reset verification** — click again to remove verification.

The customer can also request a new confirmation email by logging into the portal.

## Editing customers

Click a customer to change their name or email.

## Deleting customers

Use the menu to permanently delete a customer account. Existing [[Orders]] from that customer are kept.

## Relationship with the portal

Customers register at `/portal/register`. After verification they can log in at `/portal/signin` and view their own [[Orders]].
