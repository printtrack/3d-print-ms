---
title: "Settings → Machines"
description: "Add 3D printers, configure build volume and set hourly rate"
route: "/admin/settings?tab=maschinen"
icon: "Printer"
group: "Knowledge & Admin"
order: 9.4
---

# Managing machines

![Settings Machines](/wiki-screenshots/settings-machines.png)

The **Machines** tab manages the list of available 3D printers. Only machines added here can be assigned to [[Print Jobs]].

## Adding a machine

1. Click **+ Add machine**.
2. Fill in the required fields (name, build volume).
3. Add optional fields (model, hourly rate, notes).
4. Click **Save**.

The machine is immediately available and can be assigned to new jobs.

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Name** | yes | Internal identifier (e.g. "Bambu X1 Carbon #1") |
| **Model** | no | Manufacturer and model (e.g. "Bambu Lab X1 Carbon") |
| **Build volume X** | yes | Width of the print space in mm |
| **Build volume Y** | yes | Depth of the print space in mm |
| **Build volume Z** | yes | Height of the print space in mm |
| **Hourly rate (€/h)** | no | Used for future cost calculations |
| **Notes** | no | Free text for special requirements (e.g. specific filament requirements) |
| **Active** | — | Inactive machines do not appear for new jobs |

## Build volume and the job planner

The build volume is **critical for the automatic job planner**. The planner calculates how many parts fit on the print bed simultaneously and checks:

1. Footprint of each part (width × depth of bounding box) against the machine's build volume X × Y
2. Height of the part against build volume Z

If you enter the wrong build volume, the planner may suggest combinations that are physically impossible.

## Editing a machine

Click the **pencil icon** next to the machine, change the fields, and click **Save**.

## Deactivating a machine

Set the **Active** toggle to off. The machine remains visible in the list and historical jobs are preserved — it simply won't be offered for selection when creating new jobs.

## Outage & maintenance

Each machine has a **status dot** on the left: green = operational, red = down, amber = maintenance scheduled. Unlike the *Active* toggle (permanent retirement), an outage represents a **temporary** unavailability.

### Reporting an outage or maintenance

1. Click the **wrench icon** next to the machine (*Report outage / maintenance*).
2. Choose the **reason** (Defect or Maintenance) and optionally add a note.
3. For **maintenance planned in advance**, tick *Schedule maintenance in advance* and set a planned start. Without the tick, the outage starts **immediately**.
4. Click **Mark as down**.

While a machine is down it is **no longer proposed** by the [[Druckjobs|print-job planner]], and planned jobs on it are **not started automatically**.

### Rescheduling affected jobs

When you report an **immediate** outage, the **reschedule assistant** opens right away: it lists the running and planned jobs on that machine. For each job you choose whether to move it to another suitable machine or send it back to the backlog (unplanned). Affected jobs are also flagged in the timeline with a red border and a ⚠ marker.

### Marking available again

Once the repair or maintenance is finished, click **Mark available**. The outage is closed with an end timestamp and the machine is immediately available again. You never have to estimate a repair duration up front.

### Downtime history

Use the **arrow** next to a machine to expand its **downtime history** — every past and ongoing outage with reason, time range, and note. This history is the foundation for future utilization and effectiveness statistics.

## Deleting a machine

Click the **trash icon**. A machine can only be deleted if **no active jobs** are assigned to it. Close or remove the jobs first.
