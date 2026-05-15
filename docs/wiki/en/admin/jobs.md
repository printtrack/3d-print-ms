---
title: "Print Jobs"
description: "Plan, start and complete print jobs with auto-transitions"
route: "/admin/jobs"
icon: "Layers"
group: "Orders & Production"
order: 3
---

# Print Jobs

Print jobs manage the actual production on [[Settings → Machines|settings-machines]]. A job can bundle multiple [[Orders]] and runs on exactly one machine.

![Print Jobs overview](/wiki-screenshots/jobs.png)

## Views

Toggle between **Gantt** (default) and **Board** at the top right.

### Gantt view

Shows all jobs as a horizontal timeline (similar to a Gantt chart), sorted by start time and machine. At a glance you can see:

- Which machine is occupied and when
- How long a job will take (if print time is entered)
- Overlaps or free time windows

Click a job to open its detail view on the right.

### Board view

Shows jobs per machine as Kanban columns, top to bottom in queue order. The Board view is best for:

- Creating new jobs via the **+ Job** button in a machine column
- A quick overview of each machine's current workload
- Manual status changes

> Full explanation of the board → [[Create & manage print jobs|jobs-create]]

## Job status

| Status | Meaning | Color |
|--------|---------|-------|
| **Planned** | Start time is in the future | Gray |
| **In Progress** | Currently running on the machine | Blue |
| **Done** | Print time elapsed or manually completed | Green |

## Auto-transition (automatic status change)

The system checks every 60 seconds whether jobs should be automatically advanced:

**Planned → In Progress**
: As soon as the planned start time is reached.

**In Progress → Done**
: As soon as `start time + print time (minutes)` has elapsed. If no start time is set, `plannedAt + print time` is used.

> Jobs **without** a print time entered are **never** auto-completed — you must confirm completion manually.

Auto-transitions are recorded in the audit log without a user.

## Filament usage

In the job detail you record filaments used with gram amounts. The entered usage is immediately deducted from stock in [[Inventory]].

## Automatic job planning

**Suggest print jobs** (wand icon) lets the system automatically calculate which parts fit on which machines:

1. The system reads all print-ready parts (part phase: Print Ready) from open orders.
2. It calculates the footprint of each part from its bounding box.
3. It tries to distribute parts optimally across available machines (bin-packing algorithm).
4. You are presented with a suggestion that you can accept, adjust, or reject.

If a print orientation has been set for a part in the [[3D Viewer & Print Orientation|orders-3dviewer]], the planner uses the footprint of the rotated bounding box — leading to more realistic packing.

## Sub-pages

- [[Create & manage print jobs|jobs-create]] — step by step: create job, assign orders, record filament usage
