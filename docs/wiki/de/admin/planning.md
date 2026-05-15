---
title: "Planung"
description: "Kalender- und Ressourcenplanung für Maschinen und Druckjobs"
route: "/admin/planning"
icon: "CalendarRange"
group: "Planung & Ressourcen"
order: 5
---

# Planung

Der Planungsbereich gibt einen kalenderorientierten Überblick über anstehende [[Druckjobs]] und die Auslastung der [[Einstellungen → Maschinen|settings-machines]].

![Planungsübersicht](/wiki-screenshots/planning.png)

## Kalenderansicht

Zeigt geplante und laufende Jobs auf einem Zeitstrahl:

- **Horizontale Achse** — Datum und Uhrzeit
- **Vertikale Achse** — Maschinen
- **Balken** — Druckjobs; Länge entspricht der eingetragenen Druckzeit
- **Farbe** — entspricht dem Job-Status (Geplant = grau, In Bearbeitung = blau, Fertig = grün)

Klicke auf einen Job-Balken, um die Job-Detailansicht zu öffnen.

## Ressourcenplanung

Die Ansicht zeigt sofort, wann welche Maschine frei ist:

- **Lücken** zwischen Balken = freie Zeitfenster für neue Jobs
- **Überlappungen** = mehrere Jobs sind gleichzeitig für dieselbe Maschine geplant (sollte nicht vorkommen)

> Die Planung ist **schreibgeschützt** — Jobs können nicht direkt hier erstellt oder verschoben werden. Wechsle dafür zu [[Druckjobs]].

## Tipps für die tägliche Nutzung

- Starte den Tag mit einem Blick auf die Planung, um zu sehen, welche Maschinen heute ausgelastet sind.
- Verwende die Planung als Referenz, bevor du einen neuen Job unter [[Druckjob erstellen & verwalten|jobs-create]] anlegst — so vermeidest du Terminkonflikte.
- Wenn viele Jobs in kurzer Zeit geplant sind, nutze den automatischen Planner unter [[Druckjobs]], um die Ressourcen optimal zu verteilen.
