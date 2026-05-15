---
title: "Create & manage print jobs"
description: "Step by step: create a job, assign orders, record filament usage, change status"
icon: "Layers"
group: "Orders & Production"
order: 3.1
---

# Create & manage print jobs

![Print Jobs Board view](/wiki-screenshots/jobs-board.png)

## Creating a new job

1. Switch to the **Board** view in [[Print Jobs]] (button at top right).
2. Click **+ Job** in the column of the desired machine.
3. A dialog opens — fill in the fields:

| Field | Required | Description |
|-------|----------|-------------|
| **Machine** | yes | 3D printer that will run the job |
| **Planned start** | yes | Date and time of the planned print start |
| **Print time (minutes)** | no | Estimated print duration; required for [[Print Jobs|auto-transition]] |
| **Notes** | no | Internal notes for the team |

4. Click **Create** — the job appears in the machine column with status **Planned**.

> If no machines exist, one must first be added under [[Settings → Machines|settings-machines]].

## Assigning orders to a job

In the job detail (after creating or clicking an existing job):

1. Scroll to the **Orders** section.
2. Click **Add order**.
3. Search by short code or customer name and select the desired order.
4. The order is now linked to the job — it appears in the job detail and in the [[Order detail|orders-detail]] under "Linked print jobs".

An order can be assigned to multiple jobs (e.g. when parts are distributed across different printers).

### Removing an order from a job

Click the **×** icon next to the order in the job detail. The order is preserved — only the link is removed.

## Recording filament usage

In the job detail under **Filaments**:

1. Click **Add filament**.
2. Select the filament from [[Inventory]] (material and color).
3. Enter the amount consumed in **grams**.
4. Click **Add** — the stock in [[Inventory]] is updated immediately.

Multiple filaments per job are supported (e.g. for multi-color prints or different parts).

### Deleting a filament entry

Click the trash icon next to the entry. The stock is corrected accordingly.

## Changing status manually

You can manually override a job's status at any time:

1. Open the job detail (click the job in the Board or Gantt view).
2. Click **Change status** or select the desired status from the action menu.

| Transition | When appropriate |
|------------|-----------------|
| Planned → In Progress | Print starts earlier than planned |
| In Progress → Done | Print is complete but auto-transition hasn't fired yet |
| Done → In Progress | Failed print — job needs to be repeated |

## Editing a job

Click the **Edit** icon (pencil) in the job detail to change the machine, start time, or print time after the fact.

> **Important:** Changing the start time affects auto-transition — the new time is used as the reference.

## Deleting a job

1. Open the job detail.
2. Click the **Action menu** (three dots) at the top right.
3. Select **Delete**.

Deleting a job also removes all order assignments and filament entries. Orders and inventory are unaffected (stock is reversed).

## Job labels

Each job has a six-character **short code** (e.g. `J4X9PL`) used for labels. You can search for a short code by entering it in the **Job ID search field** at the top.
