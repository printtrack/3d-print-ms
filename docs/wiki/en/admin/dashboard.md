---
title: "Dashboard"
description: "Kanban overview of all open orders by phase"
route: "/admin"
icon: "LayoutDashboard"
group: "Overview"
order: 1
---

# Dashboard

The dashboard is your daily starting point. It shows all open [[Orders]] as a Kanban board — one column per phase, sorted left to right.

![Dashboard overview](/wiki-screenshots/dashboard.png)

## Layout

Each column corresponds to an order phase configured under [[Settings → Phases|settings-phases]]:

- **Column color** — matches the phase color in Settings
- **Order count** — shown in the column header
- **Empty columns** — still displayed to maintain the full workflow overview

## Changing an order's phase

Drag an order card with **drag & drop** into a different column. The new phase is saved immediately. An entry is automatically added to the [[Order detail|orders-detail]] audit log.

> On mobile devices drag & drop is not available — a scrollable list of all orders is shown instead.

## Opening an order

Click a card to open the [[Order detail|orders-detail]] view.

## What's on an order card

| Element | Meaning |
|---------|---------|
| **Short code** | Unique order number (e.g. `A7F3`) |
| **Customer name** | Who submitted the order |
| **File count** | Number of uploaded files |
| **Part count** | Number of individual parts, if specified |
| **Assignees** | Avatar chips of assigned team members |
| **Job indicator** | Shown if the order is assigned to a print job |

## Refresh

The board is loaded when you open the page. If another team member changes phases in parallel, the page is not updated automatically — reload the page to see the current state.

## Archived orders

Archived orders do **not** appear on the Dashboard. Find them in the [[Orders]] list using the **Archived** filter.

## Typical daily workflow

1. Open the Dashboard — see at a glance where orders are in the pipeline.
2. Drag orders to the next phase when a step is complete.
3. Click an order to check details or upload files.
4. Create [[Print Jobs]] for orders that are print-ready.
