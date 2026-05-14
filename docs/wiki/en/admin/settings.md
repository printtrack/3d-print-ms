---
title: "Settings"
description: "Company name, email templates, phases, team and machines (admin only)"
route: "/admin/settings"
icon: "SlidersHorizontal"
group: "Knowledge & Admin"
order: 9
---

# Settings

The settings area is **visible to admins only**. Here you configure the entire system.

![Settings overview](/wiki-screenshots/settings.png)

## Company settings

- **Company name** — shown in the sidebar and in emails
- **Contact email** — sender address for outgoing emails

## Email templates

An automatic email can be sent to the customer on each phase change. Configure for each template:

- **Subject** (German and English)
- **Message** (German and English)
- Placeholders: `{customerName}`, `{orderNumber}`, `{phase}`, `{trackingLink}`

## Phases

Manage the phases that [[Orders]] pass through:

- **Order** — drag and drop to reorder
- **Name** — in German and English
- **Color** — shown as the column color on the [[Dashboard]]

## Team

Invite team members and manage their roles:

| Role | Permissions |
|------|------------|
| **ADMIN** | Full access including settings, team, customers |
| **MEMBER** | Orders, jobs, planning, inventory, knowledge base |

New members receive an invitation email with a link to set their password.

## Machines

Create 3D printers that can be selected when scheduling [[Print Jobs]]:

- **Name** and **model**
- **Active/Inactive** — inactive machines no longer appear when creating new jobs
