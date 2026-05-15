---
title: "Order detail"
description: "Change phase, manage parts, files, comments and audit log"
icon: "ClipboardList"
group: "Orders & Production"
order: 2.1
---

# Order detail

The detail view opens when you click an order in the [[Orders]] list. It contains all information and actions for a single order.

## Header

The top section shows the most important data at a glance:

- **Short code** — unique order number (e.g. `A7F3`), also used for labels
- **Submission and modification date**
- **Current phase** with color indicator
- **Action menu** (top right, three dots) for archiving etc.

## Changing the phase

1. Select the new phase from the **Phase** dropdown.
2. The change is saved immediately — an entry in the audit log is created automatically.
3. If an email template is configured for this phase, the customer receives an automatic notification.

> Phases are configured under [[Settings → Phases|settings-phases]].

## Assignees

You can assign one or more team members to an order:

1. Click **Assignees** in the sidebar.
2. Select team members from the dropdown.
3. The assignment is internal only — customers cannot see it.

## Parts

Complex orders consist of multiple individual parts. The **Parts** section lets you manage these:

- **Add part** — click `+ Part`, provide a name and optional quantity
- **Part phase** — each part has its own phase (e.g. Design → Review → Print Ready → Printed). Part phases are configured under [[Settings → Phases|settings-phases]].
- **Part files** — STL/3MF files can be assigned directly to a specific part
- **Assignees per part** — a specific part can be assigned to an individual team member

## Files

### Customer files

Files uploaded by the customer when submitting the order. These can be opened in the [[3D Viewer & Print Orientation|orders-3dviewer]].

### Upload team files

1. Click **Upload file** in the files section.
2. Select one or more files (JPG, PNG, GIF, WebP, STL, OBJ, 3MF — max 50 MB per file).
3. Files are then visible to all team members, not to the customer.

### Downloading or deleting files

- **Download** — click the filename
- **Delete** — click the trash icon next to the file. This action is irreversible.

## Comments

The comment field at the bottom is for internal team notes.

- Comments are **internal only** — customers cannot see them.
- Each comment is recorded with author and timestamp.
- Comments cannot be edited or deleted (audit integrity).

## Survey result

If the order includes a customer satisfaction survey, the result is shown here (rating and optional customer comment).

## Audit log

The audit log at the bottom automatically records **every change** to the order:

| Event | Entry |
|-------|-------|
| Phase change | From/to phase with timestamp and user |
| File uploaded | Filename, timestamp, user |
| Comment added | Timestamp and user |
| Job linked/removed | Print job name |

The log is read-only.

## Linked print jobs

The sidebar shows which [[Print Jobs|jobs]] this order is currently assigned to. You can change the assignment directly here or open the linked job.

## Archiving an order

1. Click the **Action menu** (three dots) in the top right.
2. Select **Archive**.
3. The order disappears from the active [[Orders]] list.
4. Archived orders can be found again via the **Archived** filter in the list.

Archived orders can be reactivated by removing the archive flag (same menu item).
