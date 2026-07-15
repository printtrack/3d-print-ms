---
title: "Settings → Roles & permissions"
description: "Create custom roles, grant permissions and set up the assignment lock"
route: "/admin/settings?tab=rollen"
icon: "ShieldCheck"
group: "Knowledge & Admin"
order: 9.25
---

# Roles & permissions

![Roles and permissions](/wiki-screenshots/settings-roles.png)

Under **Settings → Roles & permissions** you define your own roles — "Student" or "Supervisor", say — and tick what their members may do. Assigning a role to a person happens in the [[Settings → Team]] tab.

## The two layers

Every account has **two** independent settings:

| Field | Meaning |
|-------|---------|
| **Access level** | `Admin` or `Team member`. Admins always have full access. |
| **Role & permissions** | Team members only: which of the permissions below apply. |

**Admins bypass every check.** They deliberately cannot be given a role — it would suggest a limit that does not exist. This is also what makes lockout impossible: a misconfigured role can never trap an admin.

## Creating a role

1. Click **Add role**.
2. Give it a name (e.g. "Student") and optionally a description.
3. Decide on the **assignment lock** (see below).
4. Tick the permissions. Delete rights are marked red and off by default.
5. **Save**.

Permissions belonging to switched-off modules are hidden — if you disabled quotes under [[Settings → Modules]], the "Billing" group does not appear at all.

The **Team member** role is the default one: it applies to every member without a role of their own and cannot be deleted or renamed — you may however change its permissions.

A role that still has members **cannot** be deleted. Move those people to another role first. Otherwise they would silently fall back to the default role and suddenly be allowed more than intended.

## The assignment lock

This is the restrictive option for situations where nobody should touch other people's work — a classroom, for instance.

> **Only edit assigned orders:** members still see **everything**, but may only edit orders they are assigned to.

Reading therefore stays open to everyone: the kanban board, the order list and every detail page remain visible. On somebody else's order a notice appears instead — **"Read-only — you are not assigned to this order"** — and phase, order type, deadline, assignment and archiving are disabled.

### When does an order count as "mine"?

As soon as you are assigned at any of these three levels:

- directly on the **order** (the assignee stack in the header)
- on a **part** of the order
- on a **milestone task** of the order

This is exactly the same rule as the person filter in the order list: **whatever you see there when filtering by yourself is what you may edit.**

### Where the lock does not apply

The knowledge base and inventory have no assignment concept. There the tick box alone decides. So to stop a student from deleting wiki entries, take **Delete knowledge entries** away — the lock will not help there.

**Print jobs** follow a stricter rule: a shared job may hold parts from several orders. A restricted member may only edit it with access to **all** the orders involved — otherwise they could alter other people's parts through the shared job. An explicit assignment on the job itself counts as a deliberate exception.

**Sorting** cards within a kanban column is allowed, including other people's cards: only the order changes, never any content.

## Overriding the lock per member

The role's lock is only the default. In the [[Settings → Team]] tab you can override it per person:

| Setting | Effect |
|---------|--------|
| **Inherit from role** | Default — whatever the role says. |
| **Restricted** | This person is locked, regardless of the role. |
| **Not restricted** | Exception: this person may edit everything even though the role locks. |

So you can give the "Student" role the lock and grant one experienced person an exception — without having to make them an admin.

## Permissions at a glance

| Group | Permissions |
|-------|-------------|
| **Orders** | Create, edit, change assignments, archive, delete |
| **Billing** | Manage quotes, manage invoices, record payments |
| **Print jobs** | Plan, verify, delete |
| **Projects** | Create, edit, delete |
| **Knowledge base** | Create, edit, delete |
| **Inventory** | Edit, delete |

A few areas stay admin-only on principle and therefore never appear as tick boxes: customers, machines, settings, deleting recorded payments — and role management itself. That last one is deliberate: anyone allowed to edit roles could grant themselves every other permission.

## Changes take effect immediately

Take a permission away from a role and it applies on that person's **next click** — no re-login needed.
