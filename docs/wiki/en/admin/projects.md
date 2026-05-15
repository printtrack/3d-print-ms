---
title: "Projects"
description: "Bundle multi-part orders into a project, track progress and use Gantt view"
route: "/admin/projects"
icon: "FolderKanban"
group: "Orders & Production"
order: 4
---

# Projects

Projects group multiple [[Orders]] that belong together — for example, all parts of a larger assembly or a customer's multi-component order.

![Projects overview](/wiki-screenshots/projects.png)

## What are projects for?

When a customer submits many individual orders for the same undertaking, you can bundle them under one project. This gives you an overview of overall progress without opening each order card individually.

**Typical use cases:**
- Multiple prototype iterations of the same part
- Different components of an assembly
- Orders from multiple customers for a shared initiative

## Creating a new project

1. Click **+ New Project**.
2. Enter a **name** and optional **description**.
3. Select a **project phase** (default: first entry in [[Settings → Phases|settings-phases]]).
4. Click **Create**.

## Adding orders to a project

In the project detail:

1. Click **Add order**.
2. Search by short code or customer name.
3. Select the desired order — it appears in the project list.

Orders can belong to multiple projects.

## Project overview

The project list shows the **aggregated progress**:

- How many orders are in each phase
- Total number of orders in the project
- Current project phase

## Changing the project phase

Click the project phase in the project detail and select a new phase. Project phases are configured under [[Settings → Phases|settings-phases]].

## Milestones

In the project detail you can define **milestones**:

1. Click **Add milestone**.
2. Enter name, optional due date, and tasks.
3. Each task can be assigned to a team member.

Milestones help break larger projects into manageable steps.

## Gantt view

In the project detail, switch to the **Gantt** tab for a timeline view. It shows the included orders as horizontal bars on a time axis — useful for recognizing dependencies and the temporal flow.

## Archiving or deleting a project

- **Archive** — the project disappears from the active list; orders and data are preserved
- **Delete** — permanent; removes the project but not the linked orders
