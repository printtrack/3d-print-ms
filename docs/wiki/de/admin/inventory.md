---
title: "Inventar"
description: "Filament-Lagerbestand überwachen und verwalten"
route: "/admin/inventory"
icon: "Package"
group: "Planung & Ressourcen"
order: 6
---

# Inventar

Das Inventar verwaltet den aktuellen Filament-Lagerbestand. Der Bestand wird automatisch reduziert, wenn [[Druckjobs]] mit Filament-Verbrauch abgeschlossen werden.

![Inventar Übersicht](/wiki-screenshots/inventory.png)

## Lagerbestand anzeigen

Die Inventarliste zeigt alle eingetragenen Filamente mit:

- **Farbe und Material** (z. B. PLA, PETG, ABS)
- **Restmenge** in Gramm
- **Lieferant** und Charge (optional)

## Filament hinzufügen

1. Klicke **+ Filament**.
2. Wähle Material, Farbe und Anfangsmenge.
3. Optional: Lieferant und Charge eintragen.

## Bestand manuell anpassen

Klicke auf ein Filament, um die Menge direkt zu bearbeiten — z. B. nach einer Inventur.

## Verbrauch aus Druckjobs

Wenn du in einem [[Druckjobs|Druckjob]] Filament-Verbrauch erfasst, wird die entsprechende Menge automatisch vom Bestand abgezogen.

## Nachbestellungs-Hinweis

Filamente mit einem Bestand unter dem eingestellten Mindestbestand werden rot hervorgehoben.
