---
title: "Inventory"
description: "Monitor and manage filament stock"
route: "/admin/inventory"
icon: "Package"
group: "Planning & Resources"
order: 6
---

# Inventory

The inventory manages the current filament stock. Stock levels are automatically reduced when [[Print Jobs]] with filament usage are completed.

## Viewing stock

The inventory list shows all registered filaments with:

- **Color and material** (e.g. PLA, PETG, ABS)
- **Remaining amount** in grams
- **Supplier** and batch number (optional)

## Adding a filament

1. Click **+ Filament**.
2. Select material, color, and initial quantity.
3. Optionally enter supplier and batch.

## Adjusting stock manually

Click a filament to edit its quantity directly — e.g. after a physical inventory count.

## Usage from print jobs

When you record filament usage in a [[Print Jobs|print job]], the corresponding amount is automatically deducted from stock.

## Low-stock warning

Filaments below the configured minimum stock level are highlighted in red.
