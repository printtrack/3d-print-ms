---
title: "Team"
description: "Create and invite team members, assign roles and remove members"
route: "/admin/team"
icon: "Users"
group: "Knowledge & Admin"
order: 8.5
---

# Team management

![Team](/wiki-screenshots/team.png)

**Team** (in the sidebar under "Knowledge & Admin", next to [[Customers]]) manages all user accounts in the admin backend. Customer accounts are managed separately under [[Customers]].

## Access level and role

Every account has two independent settings:

| Field | Meaning |
|-------|---------|
| **Access level** | `Admin` — full access to everything incl. settings, team, customers and machines. `Team member` — whatever the role allows. |
| **Role & permissions** | Team members only: decides the permissions. Create and edit them under [[Settings → Roles & permissions]]. |
| **Assignment lock** | Overrides per member whether only assigned orders may be edited. |

Admins deliberately get no role — they bypass every check anyway.

The **last administrator** can be neither demoted nor deleted; there must always be at least one admin account.

### Assignment lock per member

| Setting | Effect |
|---------|--------|
| **Inherit from role** | Default — whatever the role says. |
| **Restricted** | This person may only edit assigned orders. |
| **Not restricted** | Exception despite a locking role. |

A lock icon in the member list shows who the lock ends up applying to. Details under [[Settings → Roles & permissions]].

## New members: create or invite

At the top right, **Add** opens a menu with two paths:

### Create member

1. **Add → Create member**.
2. Enter name, email and a starting password.
3. Pick the access level (**Admin** or **Team member**) and — for team members — the role and assignment lock.
4. Click **Create**.

The account works immediately; you hand the password and login address to the member yourself.

### Adding via invitation link

Instead of setting a password yourself, you can send an **invitation** — just like for [[Customers]]. The new member then sets their own name and password.

1. **Add → Invite** opens the invitation dialog.
2. **Email (optional)** — With an address the invite is emailed directly and is bound to that address. Without one you get an **open link** to share (copied straight to the clipboard).
3. **Note (optional)** — e.g. "working student", for your own overview only.
4. **Access level, role and assignment lock** — you decide these up front; the invited member cannot change them.
5. Click **Invite**.

The invited person opens the link (page `/auth/accept-invite`), sets their name and password and is redirected to sign in. Each invitation is valid for **14 days** and can be redeemed **once**.

Pending invitations show up **right in the member list** — as a muted card marked **Invitation pending** (or **Invitation expired**), with the intended role and buttons to **copy the link** and **revoke** it. Once someone redeems the invitation, the card turns into a normal team member.

> If the invitation email didn't arrive, check the spam folder — or copy the open link and share it directly.

## Changing a member's role

1. Click the **edit icon** (pencil) next to the member.
2. Change the role.
3. Click **Save**.

> You cannot change your own role to prevent accidental self-demotion.

## Removing a member

1. Click the **trash icon** next to the member.
2. Confirm the dialog.

Removed members can no longer log in. Orders, comments and audit log entries assigned to the member are preserved — the name continues to be displayed.

## Changing your own credentials

Your own password and name can be changed via the profile menu at the top right of the sidebar (not via the Team section).
