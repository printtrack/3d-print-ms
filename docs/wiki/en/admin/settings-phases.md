---
title: "Settings → Phases"
description: "Create, edit and sort order phases, part phases and project phases"
route: "/admin/settings?tab=phasen"
icon: "Layers"
group: "Knowledge & Admin"
order: 9.2
---

# Managing phases

![Settings Phases](/wiki-screenshots/settings-phases.png)

Phases control which stages an order, an individual part, or a project passes through. The configuration is divided into three areas: **Order phases**, **Part phases**, and **Project phases**.

## Order phases (Tab: Phases)

Order phases form the columns of the [[Dashboard]] and define the workflow for each customer order.

### Adding a phase

1. Scroll to the end of the phase list and click **+ Add phase**.
2. Fill in name (DE and EN), color, and optional flags.
3. Click **Save**.

### Phase fields

| Field | Description |
|-------|-------------|
| **Name (DE)** | German phase name (e.g. "In Bearbeitung") |
| **Name (EN)** | English phase name (e.g. "In Progress") |
| **Color** | Hex color code or color picker — shown as column color on the Dashboard |
| **Default** | This phase is automatically assigned to new orders |
| **Survey phase** | Customers receive the satisfaction survey after reaching this phase |
| **Prototype phase** | Marks prototype orders (optional flag) |

### Changing the order

Drag a phase to the desired position using **drag & drop**. The new order is saved immediately and reflected on the [[Dashboard]].

### Editing a phase

Click the **pencil icon** next to a phase, edit the fields, and click **Save**.

### Deleting a phase

Click the **trash icon** next to the phase. A phase can only be deleted if **no orders** are assigned to it. Move the orders to another phase first.

> The default phase (where new orders land) cannot be deleted while marked as default. Set another phase as default first.

---

## Part phases (Tab: Part phases)

Part phases control the progress of individual parts within an order (e.g. Design → Review → Print Ready → Printed).

### Fields

| Field | Description |
|-------|-------------|
| **Name** | Part phase name |
| **Color** | Color indicator in the order detail view |
| **Default** | New parts start in this phase |
| **Print ready** | Parts in this phase are considered by the job planner |
| **Review** | Marks the quality control phase |
| **Printed** | Parts that have completed printing |
| **Failed print** | Marks failed prints |

### Influence on the job planner

The automatic planner specifically looks for parts whose phase has the **Print ready** flag. Set this flag correctly so the planner only schedules fully prepared parts.

---

## Project phases (Tab: Project phases)

Project phases control the overall status of a [[Projects|project]] (e.g. Planning → Active → Completed).

Configuration works the same as order phases (name, color, default flag, drag & drop).
