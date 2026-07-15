---
title: "Settings → Team"
description: "Invite team members, manage roles and remove members"
route: "/admin/settings?tab=team"
icon: "Users"
group: "Knowledge & Admin"
order: 9.3
---

# Team management

![Settings Team](/wiki-screenshots/settings-team.png)

The **Team** tab manages all user accounts in the admin backend. Customer accounts are managed separately under [[Customers]].

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

## Inviting a team member

1. Click **Invite member**.
2. Enter name and email address.
3. Select the role (**Admin** or **Team member**).
4. Click **Send invitation**.

The invited member receives an email with a link to set a password and log in. The link is valid for 24 hours.

> If the invitation email didn't arrive, check the spam folder. Alternatively, share the password reset link at `/auth/reset-password` with the member.

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
