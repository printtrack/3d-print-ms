---
title: "Inventory"
description: "Monitor and manage filament stock levels and usage"
route: "/admin/inventory"
icon: "Package"
group: "Planning & Resources"
order: 6
---

# Inventory

The inventory manages the current filament stock. Stock levels are automatically reduced when [[Create & manage print jobs|jobs-create|print jobs]] with filament usage are recorded.

![Inventory overview](/wiki-screenshots/inventory.png)

## Viewing stock

The inventory list shows all registered filaments with:

| Column | Content |
|--------|---------|
| **Color** | Color preview and name |
| **Material** | e.g. PLA, PETG, ABS, ASA, TPU |
| **Remaining** | Current stock in grams |
| **Minimum stock** | Threshold for low-stock warning |
| **Supplier** | Optional supplier name |
| **Batch** | Optional batch/LOT number |

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

## Automatic usage from print jobs

When you record filament usage in a [[Create & manage print jobs|jobs-create]] entry, the corresponding amount is **immediately** deducted from stock. If a filament entry in a job is deleted, the stock is corrected accordingly.

## Low-stock warning

Filaments whose remaining quantity falls **below the configured minimum stock** are **highlighted in red**. This lets you see at a glance which materials need to be reordered.

If no minimum stock is set, no warning is shown — even at 0 g.

## Deleting a filament

Click the **trash icon** next to the filament. Filaments referenced in active jobs cannot be deleted — remove the usage entries in the affected jobs first.
