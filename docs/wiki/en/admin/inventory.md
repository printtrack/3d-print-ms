---
title: "Inventory"
description: "Monitor and manage filament stock levels and usage"
route: "/admin/inventory"
icon: "Package"
group: "Planning & Resources"
order: 6
---

# Inventory

The inventory manages the current filament stock. Physical stock decreases only when a part is verified (weighed) in a print job. As long as jobs are still **planned** or printing, their filament demand counts as **reserved** and lowers the **available** quantity.

![Inventory overview](/wiki-screenshots/inventory.png)

## Available vs. Reserved vs. In stock

Three related figures shown side by side:

| Figure | Meaning |
|--------|---------|
| **In stock** | Filament physically present. Only changes through verification (part weighed) or manual correction. |
| **Reserved** | Sum of the estimated amounts of all active jobs (PLANNED/SLICED/IN_PROGRESS/AWAITING_VERIFICATION) that use this filament. Taken from G-code data (if uploaded) or from each part's `gramsEstimated`. |
| **Available** | `In stock − Reserved`. Can become negative if more is planned than is in stock — the row turns red in that case. |

## Viewing stock

The inventory list shows all registered filaments with:

| Column | Content |
|--------|---------|
| **Color** | Color preview and name |
| **Material** | e.g. PLA, PETG, ABS, ASA, TPU |
| **Available** | What is free after subtracting all reservations. Red on overcommit. |
| **Reserved** | Reserved quantity across active jobs |
| **In stock** | Physical quantity / spool weight |
| **Price** | Optional price per kg |

## Adding a filament

1. Click **+ Filament**.
2. Select **material** and **color** (or enter a custom color).
3. Enter the **initial quantity in grams** (e.g. 1000 g for a 1 kg spool).
4. Optional: enter **minimum stock**, **supplier**, and **batch**.
5. Click **Save**.

## Adjusting stock manually

Click a filament to edit the quantity directly — for example after a physical stock count or when a new spool arrives.

**Typical use cases:**
- New spool delivered → increase stock by 1000 g
- Filament used in a test/calibration print → manually reduce stock
- Inventory count showed a discrepancy → correct the stock

## Reservation vs. real consumption

- **When a job is planned** (status PLANNED), the required filament becomes **reserved** — stock itself is not touched.
- **When a part is verified** (piece weighed), the measured amount is deducted from stock. That is the moment the physical stock drops.
- When a job moves to DONE or CANCELLED, its reservation disappears.

This lets you plan filament use ahead of time without distorting the books: anything that wasn't actually printed doesn't count as consumed.

## Overcommit warning when planning

The [[Suggest print jobs|jobs|job suggestion dialog]] checks per proposed job whether available stock is sufficient for the required filament. If not, a red warning appears on the row. Clicking **Create** opens a confirmation dialog listing the affected filaments — you can still schedule the jobs (for example if a refill is expected shortly).

## Low-stock warning

Filaments below 250 g available (but not yet negative) are highlighted in amber. A negative Available value renders in red.

## Deleting a filament

Click the **trash icon** next to the filament. Filaments referenced in active jobs cannot be deleted — remove the usage entries in the affected jobs first.
