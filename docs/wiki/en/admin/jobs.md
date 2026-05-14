---
title: "Print Jobs"
description: "Plan, start and complete print jobs with auto-transitions"
route: "/admin/jobs"
icon: "Layers"
group: "Orders & Production"
order: 3
---

# Print Jobs

Print jobs manage the actual production on [[Settings|machines]]. A job can bundle multiple [[Orders]].

![Print Jobs overview](/wiki-screenshots/jobs.png)

## Views

Toggle between **Timeline** (default) and **Queue** at the top left.

### Timeline view

Shows all jobs on a time axis sorted by start time and machine. Instantly see which machine is occupied when.

### Queue view

Shows jobs per machine as Kanban columns — useful for quickly assigning new jobs.

## Creating a new job

1. Click **+ Job** in the Queue view for the desired machine.
2. Select machine, planned start time, and optional print time in minutes.
3. Assign one or more [[Orders]].
4. Select filaments used.

## Job status

| Status | Meaning |
|--------|---------|
| **Planned** | Start time is in the future |
| **In Progress** | Currently running on the machine |
| **Done** | Print time elapsed or manually completed |

## Auto-transition

The system checks every minute whether jobs should auto-advance:

- **Planned → In Progress** when the start time is reached
- **In Progress → Done** when `start time + print time` has elapsed

Jobs **without** a print time are never auto-completed.

## Filament usage

In the job detail you can record filaments used with gram amounts. This automatically updates the stock in [[Inventory]].
