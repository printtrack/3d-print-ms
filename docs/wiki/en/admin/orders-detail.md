---
title: "Order detail"
description: "Change phase, manage parts, files, activity tabs (comments, history, customer contact)"
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

## Order Type

Next to the phase, the header shows an **order type chip**. It distinguishes what the customer selected when submitting:

- **Print only** — the customer already has a finished model (e.g. from Printables, MakerWorld or Thingiverse) and just wants it printed.
- **Design** — the customer needs a custom design or modification from the team.

This label helps with planning (plain printing vs. design effort) and is also shown as a badge on the [[Orders|Kanban card]].

If the customer picked the wrong type, you can switch it directly via the chip — the change is saved immediately and recorded in the [[Audit Log]].

### Model links

For **Print only** orders, the customer can provide direct links to the desired models. These appear in the **description card** as clickable chips and open the source in a new tab — one click takes you straight to the original model.

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

## Activity

The Activity card at the bottom of the main area consolidates all communication and changes in one place — with four tabs:

### Tab: All

Shows a chronological mix of internal comments, customer messages and audit entries (newest first). You can write an internal comment here.

### Tab: Comments

Shows only **internal team comments**.

- Comments are **internal only** — customers cannot see them.
- Each comment is recorded with author and timestamp.
- Comments cannot be edited or deleted (audit integrity).

### Tab: History

Shows the **audit log** — an automatic record of every change to the order (read-only):

| Event | Entry |
|-------|-------|
| Phase change | From/to phase with timestamp and user |
| File uploaded | Filename, timestamp, user |
| Comment added | Timestamp and user |
| Job linked/removed | Print job name |
| Customer message sent | Message preview |

### Tab: Customer Contact

Send a direct message to the customer by email without leaving the system:

1. Switch to the **Customer Contact** tab.
2. Write your message in the text field (a hint shows the target email address).
3. Click **Send to customer** — the message is emailed immediately.

Sent messages appear in the **Customer Contact** and **All** tabs with the *"Sent to customer"* badge.

The email template (subject and wrapper text) can be configured under [[Settings → Emails|settings]] (section "Customer Message Email").

## Survey result

If the order includes a customer satisfaction survey, the result is shown here (rating and optional customer comment).

## Roadmap strip with sprints

Orders that aren't part of a [[Projects|project]] show a **Roadmap card** with a horizontal timeline at the top of the sidebar. It replaces the previous flat milestone list and groups dates by **sprint**.

### Sprint switcher

- Each order can have several parallel/sequential sprints (e.g. "Pilot run", "Main run", "Post-run").
- Pick the active sprint via the pills at the top. The mini donut next to each sprint name shows the percentage of completed tasks across all milestones in that sprint.
- Click the `+` button at the end of the sprint list to create a new sprint. The Add-Milestone popover opens automatically afterwards.
- The kebab menu next to each sprint exposes **Rename** and **Delete sprint**. Deleting opens a confirmation popover that lists how many milestones and tasks would be affected.

### Milestone stops

Inside the active sprint the timeline shows one round stop per milestone:
- **Green check** — done
- **Brand flag** — current
- **Red warning stop** — overdue (due date is in the past and not all tasks are done)
- **Pizza-slice ring** — one slice per task, filled as soon as the task is checked off

Click a stop to open a popover with its task list:
- Check tasks off individually (the slice-flash animation fires on the ring)
- When the final task is checked off, the stop celebrates with a quick pop and sparkles
- Name, date and individual tasks are inline-editable (Enter saves, Esc discards)
- Delete a task: × appears on hover at the end of its row
- Delete a milestone: subtle link at the bottom of the panel → inline confirm

### Adding a new milestone

1. Click the `+` icon in the top-right of the roadmap card.
2. Fill in **Name** and **Due date** (both required).
3. Saving creates the milestone in the active sprint and immediately opens its popover so you can add tasks.

## Billing

The right-hand sidebar holds the **quote** and **invoice** cards. The entire billing process runs from here: create and send a quote, customer approval, issue an invoice, record payments, plus reminders and cancellation. The full flow is described under [[Quotes & Invoices|billing]].

## Linked print jobs

The sidebar shows which [[Print Jobs|jobs]] this order is currently assigned to. You can change the assignment directly here or open the linked job.

## Archiving an order

1. Click the **Action menu** (three dots) in the top right.
2. Select **Archive**.
3. The order disappears from the active [[Orders]] list.
4. Archived orders can be found again via the **Archived** filter in the list.

Archived orders can be reactivated by removing the archive flag (same menu item).
