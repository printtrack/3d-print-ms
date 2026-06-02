---
title: "Projects"
description: "Bundle work beyond single print orders: sprint roadmap, files with their own phases, internal comments and Gantt view"
route: "/admin/projects"
icon: "FolderKanban"
group: "Orders & Production"
order: 4
---

# Projects

Projects bundle work that is **not directly a single print order** — for example event planning, a trade-show booth, or a larger assembly made of many parts. They optionally link several [[Orders]] and add their own planning, files and communication.

![Projects overview](/wiki-screenshots/projects.png)

## What are projects for?

Whenever something is more than a plain print order. A project has its own roadmap, its own files and an internal comment history — regardless of whether (and how many) orders are attached.

**Typical use cases:**
- Event planning or a trade-show booth with many work steps
- Different components of an assembly
- Several prototype iterations of the same part
- Orders from multiple customers for a shared undertaking

## Create a new project

1. Click **+ New project**.
2. Enter a **name** and optional **description**.
3. Pick a **project phase** (default: first entry in [[Settings → Phases|settings-phases]]).
4. Click **Create**.

## Project detail view

A **sticky header** stays visible while scrolling. It shows:

- **Name + phase chip** — click the colored chip to switch the project phase directly
- **Deadline** — with an "Overdue" marker once the date has passed
- **Assignees** — the team members as avatars

## Sprint roadmap & milestones

Every project has a **roadmap** of sprints and milestones — the same feature as in the order detail view:

1. Create a **sprint** via **+** (e.g. a project stage or work package).
2. Add **milestones** with a name and due date per sprint.
3. Each milestone can hold **tasks**; progress is shown as a bar.

The due date must fall between the project's creation date and its deadline.

## Project files

In the project detail you can **upload files** (by click or drag & drop). Unlike order files, project files move through **their own freely configurable file phases** (e.g. *Draft → In Review → Final*):

- Each file is assigned the **default file phase** on upload.
- Use the per-file dropdown to change the phase at any time.
- Files can be downloaded or deleted.

File phases are managed under [[Settings|settings]] in the **Project file phases** tab (create, rename, color, order, default).

## Internal comments

The comment area is a **purely internal** team conversation about the project. Unlike orders, there is **no** sending to customers; external communication happens through separate channels.

## Link orders to the project

In the sidebar of the project detail:

1. Click **Link**.
2. Search by short code or customer name.
3. Pick the order — it appears in the project list.

Use the **unlink** icon to remove the assignment. Linked orders keep **their own** roadmap in addition to the project roadmap.

## Change the project phase

Click the phase chip in the header and pick a new phase. Project phases are configured under [[Settings → Phases|settings-phases]].

## Gantt view

In the projects overview the **Gantt** view shows the contained orders as horizontal bars on a timeline — useful to spot dependencies and the overall schedule.

## Archive or delete a project

- **Archive** — the project disappears from the active list; orders and data are kept
- **Delete** — permanent; removes the project along with its files and comments, but not the linked orders
