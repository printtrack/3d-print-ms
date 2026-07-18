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

## Connection to the printer

So that a [[Druckjobs|print job]] can be sent straight to the printer, you configure the **connection to the printer** in the machine editor. Open a machine via the **pencil icon** and pick the **vendor** first, then the **model**:

- **None** — the machine is for planning only, nothing is sent to hardware.
- **Prusa → CORE One (Connect/Cloud)** — connected via the **Prusa Connect cloud** (exactly the path OrcaSlicer/PrusaSlicer use). Reachable from anywhere, **no VPN needed**. You enter just the **Prusa Connect API key**, which you generate in Prusa Connect under printer → Settings → *API keys*.
- **Prusa → CORE One (PrusaLink/local)** — an alternative via **PrusaLink** (the printer's local API) for same-network operation. You enter the **printer address** (e.g. `http://192.168.1.50`) and the **PrusaLink API key**.
- **Ultimaker → S3** — connected via the **Ultimaker Digital Factory** (cloud). You enter an **access token** and the **cluster / printer ID**, optionally a **base URL**.
- **Test → Mock printer** — a simulated printer for trying the flow without real hardware; you pick the **simulated state** (e.g. *Ready* or *Printing*).

The **vendor + model** approach means more printers can be added later without changing how it works — a new model simply appears in the picker.

Credentials (API key / token) are stored **encrypted** and are **never** shown again in plain text — leaving the field blank when editing means "unchanged".

> **Cloud or local:** Ultimaker and the Prusa **Connect** variant run through the vendor cloud and are reachable from outside the printer network. The Prusa **PrusaLink** variant talks to the printer locally — so the server must be able to reach the printer (same network, VPN or tunnel).

### Test connection

Click **Test connection**. The system saves the entered details and queries the printer state once. On success the reported state appears (e.g. *Ready*), and the machine list shows a **printer badge** with the last-seen state.

How a job is sent to the printer and started is covered under [[Druckjobs|jobs]] → **Send to printer**.

## Deleting a machine

Click the **trash icon**. A machine can only be deleted if **no active jobs** are assigned to it. Close or remove the jobs first.
