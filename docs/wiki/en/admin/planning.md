---
title: "Planning"
description: "Workload, month and agenda views for orders, milestones, appointments and web calendars"
route: "/admin/planning"
icon: "CalendarRange"
group: "Planning & Resources"
order: 5
---

# Planning

Planning brings order delivery dates, milestones, self-created appointments **and** subscribed web calendars together in a single surface. It answers the question "who is working on what, and what is due when".

![Planning overview](/wiki-screenshots/planning.png)

## Three views

Switch between the views in the top left:

- **Workload** — a five-week timeline with one row per team member. Orders appear as bars across their span (creation → delivery date), milestones as diamonds sitting on the matching order bar. You can tell at a glance who is busy.
- **Month** — a classic month grid with continuous multi-day bars and milestone diamonds.
- **Agenda** — a chronological, day-by-day list. Overdue entries are grouped at the very top.

Clicking a bar, diamond or agenda row opens a **detail panel** on the right; for orders, "Open order" jumps straight to the order detail page.

## Toolbar

- **Search** — filters by order, customer or assignee.
- **Navigation** (‹ ›, "Today") — pages by week or month.
- **Overdue pill** — jumps to the agenda showing every overdue entry.
- **View** — hides completed items, customer names or workload counters.
- **Legend** — each chip (phase, milestone, appointment, web calendar) can be clicked to show/hide that category.

## Creating general appointments

Use **"New appointment"** (top right) to create appointments **not tied to an order** — e.g. printer maintenance, trade fairs, holidays or meetings. An appointment can be all-day or span a period and can optionally be assigned to a team member (it then shows in their workload row). Order delivery dates and milestones, by contrast, are generated automatically from orders and need no manual upkeep.

## Embedding web calendars (holiday calendars & co.)

External iCal/ICS calendars — such as school-holiday or public-holiday calendars — can be subscribed to and appear **read-only** in all three views (in the calendar's colour, with their own row in the workload view).

Subscriptions are managed shop-wide next to [[Settings → Machines|settings-machines]] under **Settings → Web calendars** (admins only):

1. Click **Add calendar**.
2. Enter a name, the public **iCal/ICS URL** (`https://…` or `webcal://…`) and a colour.
3. On save the calendar is fetched once as a test — if it is unreachable or not a valid iCal file, creation is rejected with an error message.

Subscribed calendars are refreshed in the background every 15 minutes; the row shows "Last updated" and, on failure, the last error message. Toggle a calendar off with the switch without deleting it.

## Tips for daily use

- Start the day with the **Agenda** — overdue entries sit right at the top.
- Use the **Workload** view to spot free capacity in the team before assigning a new order.
- Subscribe to a **public-holiday / school-holiday calendar** so bridge days and holidays are visible when promising delivery dates.
