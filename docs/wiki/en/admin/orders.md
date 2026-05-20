---
title: "Orders"
description: "Order list: search, filter, and sort by phase"
route: "/admin/orders"
icon: "ClipboardList"
group: "Orders & Production"
order: 2
---

# Orders

The **Orders** section manages all incoming orders. Each order passes through defined phases from intake to completion.

![Orders overview](/wiki-screenshots/orders.png)

## Order list view

The list shows all active orders with the following columns:

| Column | Content |
|--------|---------|
| **Short code** | Unique order number (e.g. `A7F3`) — also used on labels |
| **Customer** | Name and email address |
| **Phase** | Current phase with color indicator |
| **Parts** | Number of individual parts in the order |
| **Files** | Number of uploaded files (customer and team files) |
| **Date** | Order submission date |

## Search and filter

- **Search field** — filters in real time by customer name, email, or short code
- **Phase filter** — restricts the list to a specific phase; multiple phases can be combined
- **Archived toggle** — shows or hides archived orders (hidden by default)

## Opening an order

Click any row to open the [[Order detail|orders-detail]] view.

## Creating a new order

Orders are submitted by customers via the public order form (`/`). Admins cannot create orders directly in the backend — this ensures complete customer input.

## Sub-pages

- [[Order detail|orders-detail]] — change phase, files, activity tabs (comments, history, customer contact)
- [[3D Viewer & Print Orientation|orders-3dviewer]] — open models in browser, set print orientation
