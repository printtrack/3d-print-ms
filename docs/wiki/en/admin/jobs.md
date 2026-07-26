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

> Jobs **without** a print time entered use a 2-hour default — the same duration their bar is drawn with on the timeline. They move to **verification pending** as well; you confirm the result during verification as usual.

Auto-transitions are recorded in the audit log without a user.

## Filament usage

In the job detail you record filaments used with gram amounts. The entered usage is immediately deducted from stock in [[Inventory]].

## Automatic job planning

**Batching** is fully automatic, **scheduling** is your call. As soon as a part is print-ready, the next time the jobs page is opened (and every 60 seconds afterwards) a matching print job is formed:

1. The system reads all print-ready parts (part phase: Print Ready) from open orders.
2. It resolves each part's **material/color requirement** to a concrete spool and groups parts that share a spool.
3. It calculates the footprint of each part from its bounding box.
4. It distributes the parts across the available machines using bin-packing — matching parts share a job, and existing jobs that have not started yet get topped up.

New jobs start out **without a date** in the "unscheduled" area. They reach the timeline either by **drag & drop** or via the **Place on timeline** button.

### Place on timeline

The button schedules every unscheduled job in one go:

- **Deadline first:** jobs are ordered by the earliest order deadline among their parts.
- **Little setup time:** when several jobs are similarly urgent (deadlines at most 48 hours apart), the one that runs on the spools already loaded goes first — keeping filament changes to a minimum.
- Every job gets the earliest free window on its machine, at least 30 minutes ahead (lead time for loading the plate), without overlaps or maintenance windows. When a swap is needed, another 15 minutes of setup time are reserved.
- **Jobs that are already scheduled are never moved** — whatever you placed by hand stays put.

**Parts that cannot be scheduled:** if a print-ready part cannot be placed, the header shows **"N parts not schedulable"**. One click lists every part with its reason (no matching filament, no STL file, too large for all printers …) and links into the order.

### Automatic re-planning on changes

When an already scheduled part changes, it is **removed from its job and planned again automatically**. Triggers are:

- A different **color** or **material**
- A changed **quantity**
- A **new design** (new design file — the stored bounding box is re-measured as well)
- A new or reset **print orientation**
- Leaving the **Print Ready** phase

This only applies while the job is **not printing yet**. If the print is already running or the plate was dispatched to the printer, the part stays in the job — that call is yours. A job that runs empty is deleted. Every re-plan is recorded in the order's audit log.

### Filament changes

Under [[Settings → Machines|settings-machines]] every printer has a number of **material slots** (1 = single extruder, more = AMS/MMU) and a **loaded filament** per slot. That is how PrintTrack knows when someone has to swap a spool.

- If a job needs a filament that is not loaded, it is flagged **filament change required** — an amber chip on the board, a dashed outline with ⇄ on the timeline.
- The job detail spells out what to do ("remove PLA Red, load PETG Blue"). The **Change done** button confirms the swap and writes the new spools into the printer's material slots.
- **Until the change is confirmed the job does not start.** When it reaches its scheduled time it is pushed back by 15 minutes instead — so nobody ever prints in the wrong colour by accident.

On printers with several material slots the planner combines parts of different spools into one job — but only spools that are actually **loaded** there, otherwise the combined job would need a change after all. On single extruders (the default) a job always holds exactly one filament.

**Printer choice:** the planner prefers the printer that already holds the spool — that saves the swap. If no printer holds it, the machine with the least planned load takes the job so work spreads out.

### Setup time, waiting time and attendance on the timeline

A bar on the timeline shows how long the **printer is occupied** — which is more than the print itself:

| Display | Meaning |
|---------|---------|
| Amber hatching **before** the bar | Setup time: a filament change is still due |
| Solid bar | The printer is printing |
| Grey hatching **after** the bar | Done, but nobody on site — the plate occupies the printer until pickup |
| Grey band in the background | Unattended time (night, weekend) |

That explains at a glance why a job does not start on Monday morning even though the previous print finished on Saturday night: the plate was still on the bed.

**Moving a job recalculates everything.** Drag it to another time or machine and setup time, waiting time and filament changes are re-derived immediately — the print order on that printer has changed after all. If the start falls outside the attendance hours, a ☾ marks the bar: nobody can load the plate at that time.

**What a drop refuses:** a job cannot be dropped where it could not run — in the past, onto a printer that is still busy, or — while a **filament change is pending** — into unattended hours, since somebody has to swap the spool. A print that needs no swap may start any time, including at night: starting works remotely. Busy means until **pickup**: while the predecessor's finished plate is still on the bed the printer is occupied, even though its print has ended. The bar turns red while dragging and the reason appears on release.

**Build volume is checked for manual moves too:** a job cannot be dragged onto a printer too small for one of its parts — you get a message with the actual dimensions instead of a plan that could never print.

### Working through open filament changes

When at least one change is due, the header shows **"N filament changes open"**. The dialog lists them in print order, grouped by printer — walk through the workshop once and tick them off. Each tick writes the new spools into the printer's material slots and releases the job.

**Printer choice by build volume:** if a part does not fit the printer picked first, the planner falls back to the next compatible printer with a larger build volume. Only when it fits on **no** suitable printer does it end up in the not-schedulable list.

**Using material/color "any":** parts whose color (or material) is set to **any** in the [[part management|orders-detail]] can be assigned flexibly to a matching concrete job — so parts get combined and the printer is used better. Only spools whose printers can actually hold the part are considered.

**Printer compatibility:** if a filament in [[Inventory]] is compatible only with certain printers, the planner schedules the affected material on those printers only.

**Filament shortage:** if stock is not sufficient on paper, the job is still planned — the shortfall shows up in [[Inventory]] as negative availability so production does not stall.

If a print orientation has been set for a part in the [[3D Viewer & Print Orientation|orders-3dviewer]], the planner uses the footprint of the rotated bounding box — leading to more realistic packing.

## Send to printer

If the machine has a [[Einstellungen → Maschinen|settings-machines]] **cloud connection**, you can send the sliced file straight from the job to the printer. Open the job and use the **Send to printer** button in the **Printer** section.

This requires an uploaded **slicing file** (`.gcode`, `.bgcode`, `.3mf`, …) on the job. A **status badge** shows the live printer state (*Ready*, *Printing*, *Finished (bed occupied)*, *Offline*).

### Auto-start only when free

When you send, the system checks the printer state:

- **Printer is free (Ready) → start immediately.** The file is uploaded and the print is **started automatically**; the job moves to **In progress**.
- **Printer is still printing or a finished part is on the bed → upload only.** The dispatch stays at **Waiting to start**. Once the bed is clear, click **Start now**.

This way nothing is ever printed onto an occupied bed by accident. Use the **✕** to cancel a waiting or running dispatch.

The job status follows along automatically: when the printer reports the print as finished, the job moves to **Awaiting verification** — handled by the periodic background sync.

## Sub-pages

- [[Create & manage print jobs|jobs-create]] — step by step: create job, assign orders, record filament usage
