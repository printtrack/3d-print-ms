---
title: "Druckjobs"
description: "Druckaufträge planen, starten, abschließen und automatisch weiterschalten"
route: "/admin/jobs"
icon: "Layers"
group: "Aufträge & Produktion"
order: 3
---

# Druckjobs

Druckjobs verwalten die tatsächliche Produktion auf den [[Einstellungen|Maschinen]]. Ein Job kann mehrere [[Aufträge]] bündeln.

## Ansichten

Oben links schaltest du zwischen **Timeline** (Standard) und **Queue** um.

### Timeline-Ansicht

Zeigt alle Jobs als Zeitstrahl geordnet nach Startzeit und Maschine. So erkennst du auf einen Blick, welche Maschine wann belegt ist.

### Queue-Ansicht

Zeigt Jobs je Maschine als Kanban-Spalte — nützlich zum schnellen Zuordnen neuer Jobs.

## Neuen Job erstellen

1. Klicke **+ Job** in der Queue-Ansicht bei der gewünschten Maschine.
2. Wähle Maschine, geplanten Startzeitpunkt und optionale Druckzeit in Minuten.
3. Weise einen oder mehrere [[Aufträge]] zu.
4. Wähle verwendete Filamente.

## Job-Status

| Status | Bedeutung |
|--------|-----------|
| **Geplant** | Startzeitpunkt liegt in der Zukunft |
| **In Bearbeitung** | Aktuell auf der Maschine |
| **Fertig** | Druckzeit abgelaufen oder manuell abgeschlossen |

## Auto-Transition

Das System überprüft minütlich, ob Jobs automatisch weiterzuschalten sind:

- **Geplant → In Bearbeitung**, wenn der Startzeitpunkt erreicht ist
- **In Bearbeitung → Fertig**, wenn `Startzeit + Druckzeit` abgelaufen ist

Jobs **ohne** eingetragene Druckzeit werden nie automatisch abgeschlossen.

## Filament-Verbrauch

Im Job-Detail kannst du verwendete Filamente mit Gramm-Angabe erfassen. Dies aktualisiert den Lagerbestand unter [[Inventar]].
