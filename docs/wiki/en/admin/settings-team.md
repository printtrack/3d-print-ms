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

## Roles in the system

| Role | Permissions |
|------|------------|
| **ADMIN** | Full access: all areas including Settings, Team, Customers, Phases and Machines |
| **TEAM_MEMBER** | Orders, Print Jobs, Planning, Inventory, Knowledge Base — no Settings access |

At least one admin account must always exist in the system.

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
