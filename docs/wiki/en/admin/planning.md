---
title: "Planning"
description: "Calendar and resource planning for machines and print jobs"
route: "/admin/planning"
icon: "CalendarRange"
group: "Planning & Resources"
order: 5
---

# Planning

The planning area provides a calendar-based overview of upcoming [[Print Jobs]] and [[Settings → Machines|settings-machines|machine]] utilization.

![Planning overview](/wiki-screenshots/planning.png)

## Calendar view

Shows planned and running jobs on a timeline:

- **Horizontal axis** — date and time
- **Vertical axis** — machines
- **Bars** — print jobs; length corresponds to the entered print time
- **Color** — matches the job status (Planned = gray, In Progress = blue, Done = green)

Click a job bar to open the job detail view.

## Resource planning

The view immediately shows when each machine is free:

- **Gaps** between bars = free time windows for new jobs
- **Overlaps** = multiple jobs are planned simultaneously for the same machine (should not occur)

> The planning view is **read-only** — jobs cannot be created or moved directly here. Switch to [[Print Jobs]] for that.

## Tips for daily use

- Start the day with a look at planning to see which machines are occupied today.
- Use the planning view as a reference before creating a new job under [[Create & manage print jobs|jobs-create]] — this helps you avoid scheduling conflicts.
- When many jobs are planned in a short time, use the automatic planner under [[Print Jobs]] to distribute resources optimally.
