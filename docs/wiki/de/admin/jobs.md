---
title: "Druckjobs"
description: "Druckaufträge planen, starten, abschließen und automatisch weiterschalten"
route: "/admin/jobs"
icon: "Layers"
group: "Aufträge & Produktion"
order: 3
---

# Druckjobs

Druckjobs verwalten die tatsächliche Produktion auf den [[Einstellungen → Maschinen|settings-machines]]. Ein Job kann mehrere [[Aufträge]] bündeln und läuft auf genau einer Maschine.

![Druckjobs Übersicht](/wiki-screenshots/jobs.png)

## Ansichten

Oben rechts schaltest du zwischen **Gantt** (Standard) und **Board** um.

### Gantt-Ansicht

Zeigt alle Jobs als horizontalen Zeitstrahl (ähnlich einem Gantt-Diagramm), geordnet nach Startzeit und Maschine. Du siehst auf einen Blick:

- Welche Maschine wann belegt ist
- Wie lange ein Job dauert (sofern Druckzeit eingetragen)
- Überlappungen oder freie Zeitfenster

Klick auf einen Job öffnet die Detailansicht rechts.

### Board-Ansicht

Zeigt Jobs je Maschine als Kanban-Spalte, von oben nach unten in Warteschlangen-Reihenfolge. Die Board-Ansicht eignet sich besonders zum:

- Erstellen neuer Jobs per **+ Job**-Button in der Maschinenspalte
- Schnellen Überblick über die aktuelle Auslastung jeder Maschine
- Manuellen Statuswechseln

> Ausführliche Erklärung des Boards → [[Druckjob erstellen & verwalten|jobs-create]]

## Job-Status

| Status | Bedeutung | Farbe |
|--------|-----------|-------|
| **Geplant** | Startzeitpunkt liegt in der Zukunft | Grau |
| **In Bearbeitung** | Aktuell auf der Maschine | Blau |
| **Fertig** | Druckzeit abgelaufen oder manuell abgeschlossen | Grün |

## Auto-Transition (automatischer Statuswechsel)

Das System überprüft alle 60 Sekunden, ob Jobs automatisch weitergeschaltet werden müssen:

**Geplant → In Bearbeitung**
: Sobald der eingetragene Startzeitpunkt erreicht ist.

**In Bearbeitung → Fertig**
: Sobald `Startzeit + Druckzeit (Minuten)` abgelaufen ist. Falls kein `Startzeit` gesetzt ist, wird `plannedAt + Druckzeit` verwendet.

> Jobs **ohne** eingetragene Druckzeit werden **niemals** automatisch abgeschlossen — du musst den Abschluss manuell bestätigen.

Automatische Statuswechsel werden im Audit-Log ohne Benutzerangabe protokolliert.

## Filament-Verbrauch

Im Job-Detail erfasst du verwendete Filamente mit Gramm-Angabe. Der eingetragene Verbrauch wird automatisch vom Lagerbestand im [[Inventar]] abgezogen.

## Automatische Druckplanung

Über **Druckjobs vorschlagen** (Zauberstab-Symbol) lässt du das System automatisch berechnen, welche Teile auf welche Maschinen passen:

1. Das System liest alle druckbereiten Teile (Teilphase: Druckbereit) aus offenen Aufträgen.
2. Es berechnet den Footprint jedes Teils anhand seiner Bounding Box.
3. Es versucht, Teile optimal auf verfügbare Maschinen zu verteilen (Bin-Packing-Algorithmus).
4. Du bekommst einen Vorschlag präsentiert und kannst ihn annehmen, anpassen oder ablehnen.

Wenn für ein Teil im [[3D-Viewer & Druckorientierung|orders-3dviewer]] eine Druckorientierung gesetzt wurde, verwendet der Planner den Footprint der rotierten Bounding Box — was zu realistischerem Packing führt.

## Subseiten

- [[Druckjob erstellen & verwalten|jobs-create]] — Schritt-für-Schritt: Job anlegen, Aufträge zuweisen, Filament erfassen
