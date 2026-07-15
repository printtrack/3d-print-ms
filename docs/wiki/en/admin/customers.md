---
title: "Customers"
description: "Manage customer data, control email verification and understand portal access (admin only)"
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

| Column | Content |
|--------|---------|
| **Name** | Full name of the customer |
| **Email** | Registered email address |
| **Registered** | Registration date |
| **Verified** | Whether the email address has been confirmed (checkmark or warning icon) |
| **Actions** | Edit, verify, delete |

## Search

The search field at the top filters the list by name and email in real time.

## Email verification

Customers must verify their email address via a confirmation link after registration before they can use the portal.

### Manual verification by admin

If a customer hasn't received their confirmation link (spam filter, wrong email, etc.):

1. Click the **checkmark icon** next to the customer.
2. The email is immediately marked as verified — the customer can log in right away.

### Resetting verification

Click the checkmark icon again to remove verification. The customer must then re-verify.

### New verification email by customer

Alternatively, the customer can request a new confirmation email by logging into the portal (`/portal/signin`) and clicking **Resend email**.

## Editing customers

1. Click the **edit icon** (pencil) next to the customer.
2. Change name or email address.
3. Click **Save**.

> Changing the email address does **not** reset verification — reset it manually if needed.

## Deleting customers

1. Click the **trash icon** next to the customer.
2. Confirm the dialog.

The customer account is permanently deleted. Existing **orders** linked to that customer are preserved — only the link to the portal account is removed.

## Invitations

Below the customer list you manage **invitations** to the customer portal. The section appears as
long as registration is not set to "Closed" — how new accounts come into existence at all is
decided under [[Settings|settings]] → Order intake.

Two kinds of invitation:

- **With an email address** — the invitation is sent straight to that address and is valid for it
  only. Since the recipient received the link at that address, the account is unlocked right away;
  [email verification](#email-verification) is skipped. If an account already exists for that
  address, the system refuses the invitation.
- **Without an email address** — you get a link to pass on, redeemable by whoever holds it. The
  link is copied to your clipboard automatically once created.

A **note** (e.g. "trade fair contact") helps you match it up later; the customer never sees it.

Every invitation is **valid for 14 days** and **redeemable once**. The list shows each invitation's
state — Open, Redeemed or Expired. For open invitations you can re-copy the link via the copy icon,
and the bin icon revokes an invitation at any time.

## The customer portal

Customers register themselves at `/portal/register` — provided registration is open. If it is set
to "Invitation only", an invitation link is the only route to an account; with "Closed" no new
accounts are created at all. After successful email verification they can log in at
`/portal/signin` and:

- View their own orders and track status
- Submit new orders
- Upload files for their orders

The portal is completely separate from the admin interface — customers cannot see internal notes, comments, or audit logs.
