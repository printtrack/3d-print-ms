---
title: "Settings → Attendance hours"
description: "When somebody is on site — the basis for start, filament change and pickup"
route: "/admin/settings?tab=anwesenheit"
icon: "CalendarClock"
group: "Knowledge & Admin"
order: 9.5
---

# Attendance hours

Printers run around the clock, people do not. Under **Settings → Attendance hours** you define when somebody is on site. [[Automatic job planning|jobs]] then schedules everything that needs a person at the printer inside those hours:

- **Filament changes**
- **Taking the finished part off**

The print itself may run through — overnight and across the weekend. And since prints can be **started remotely**, the start may fall outside attendance hours too, as long as no filament change is due.

## Setting it up

1. Tick **Take attendance hours into account**. Without the tick PrintTrack schedules around the clock as before.
2. Enter start and end per weekday. A day without a tick means "nobody on site".
3. **Save**.

> Example: Mon–Fri 08:00–18:00. A print starting Friday at 16:00 and running 30 hours finishes on Saturday night — but it is only taken off on Monday at 08:00. Until then the printer stays occupied, because the plate is still on the bed. That is exactly how PrintTrack schedules the next job on that printer.

## Effect on the timeline

On the [[print jobs|jobs]] timeline, unattended periods are shaded with a grey band. In addition, every job shows how long the printer is occupied beyond the pure print time:

- Amber hatching before: pending filament change (setup time)
- Grey hatching after: finished, but the plate is still on the bed

## Limits

- The hours apply to **the whole shop**, not per printer.
- The weekly schedule knows nothing about holidays or vacation — report the affected printer as an outage under [[Settings → Machines|settings-machines]] instead.
