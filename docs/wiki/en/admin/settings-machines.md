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

## Deleting a machine

Click the **trash icon**. A machine can only be deleted if **no active jobs** are assigned to it. Close or remove the jobs first.
