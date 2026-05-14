---
title: "Orders"
description: "Manage orders: change phases, upload files, comments, audit log"
route: "/admin/orders"
icon: "ClipboardList"
group: "Orders & Production"
order: 2
---

# Orders

The **Orders** section manages all incoming orders. Each order passes through defined phases from intake to completion.

## Order list (`/admin/orders`)

The list shows all orders with status, customer name, date, and file count.

- **Search** — filter by customer name, email, or order number
- **Filter** — restrict to a specific phase
- **Click an order** — opens the detail view

## Order detail (`/admin/orders/[id]`)

### Changing the phase

Select the new phase from the **Phase** dropdown. The change is saved immediately and recorded in the **Audit Log** at the bottom.

### Files

- **Upload team files** — upload design files (STL, OBJ, 3MF, images) for production
- **Customer files** — files the customer uploaded when submitting the order
- Supported formats: JPG, PNG, GIF, WebP, STL, OBJ, 3MF (max 50 MB each)

### 3D Model Viewer

Click an STL/OBJ/3MF file to view it as a 3D model directly in the browser. You can rotate, zoom, and add **notes** at specific locations on the model.

### Comments

The comment field at the bottom is for internal team notes — customers do not see these.

### Audit Log

Every phase change, file upload, and comment is automatically recorded with timestamp and user.

### Archiving an order

Click **Archive** (top-right menu) to remove a completed order from the active view. Archived orders remain in the database and can be shown via the **Archived** filter.

## Related areas

- Configure phases → [[Settings]]
- Assign to a print job → [[Print Jobs]]
- Add to a project → [[Projects]]
