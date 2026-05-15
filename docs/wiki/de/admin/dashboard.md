---
title: "Dashboard"
description: "Kanban-Übersicht aller offenen Aufträge nach Phase"
route: "/admin"
icon: "LayoutDashboard"
group: "Übersicht"
order: 1
---

# Dashboard

Das Dashboard ist der tägliche Ausgangspunkt. Es zeigt alle offenen [[Aufträge]] als Kanban-Board — eine Spalte pro Phase, von links nach rechts sortiert.

![Dashboard Übersicht](/wiki-screenshots/dashboard.png)

## Aufbau

Jede Spalte entspricht einer Auftragsphase, die unter [[Einstellungen → Phasen|settings-phases]] konfiguriert ist:

- **Spaltenfarbe** — passt zur Farbe der Phase in den Einstellungen
- **Auftragsanzahl** — wird im Spaltenkopf angezeigt
- **Leere Spalten** — werden trotzdem angezeigt, damit der Gesamtüberblick erhalten bleibt

## Phase eines Auftrags ändern

Ziehe eine Auftragskarte per **Drag & Drop** in eine andere Spalte. Die neue Phase wird sofort gespeichert. Im [[Auftrags-Detailansicht|orders-detail|Audit-Log]] des Auftrags erscheint automatisch ein Eintrag.

> Auf Mobilgeräten ist Drag & Drop nicht verfügbar — dort erscheint stattdessen eine scrollbare Liste aller Aufträge.

## Auftrag öffnen

Klicke auf eine Karte, um die [[Auftrags-Detailansicht]] zu öffnen.

## Inhalt einer Auftragskarte

| Element | Bedeutung |
|---------|-----------|
| **Kurzcode** | Eindeutige Auftragsnummer (z. B. `A7F3`) |
| **Kundenname** | Absender des Auftrags |
| **Dateianzahl** | Anzahl der hochgeladenen Dateien |
| **Teilanzahl** | Anzahl der Einzelteile, falls angegeben |
| **Beauftragte** | Avatar-Chips der zugewiesenen Teammitglieder |
| **Jobanzeige** | Falls der Auftrag einem Druckjob zugeordnet ist |

## Aktualisierung

Das Board wird beim Öffnen der Seite geladen. Wenn ein anderes Teammitglied parallel Phasen ändert, wird die Seite nicht automatisch aktualisiert — lade die Seite neu, um den aktuellen Stand zu sehen.

## Archivierte Aufträge

Archivierte Aufträge erscheinen **nicht** auf dem Dashboard. Du findest sie in der [[Aufträge|Auftragsliste]] über den Filter **Archiviert**.

## Typischer Tagesablauf

1. Öffne das Dashboard — sieh auf einen Blick, wo Aufträge stecken.
2. Ziehe Aufträge in die nächste Phase, wenn ein Arbeitsschritt abgeschlossen ist.
3. Klicke auf einen Auftrag, um Details zu prüfen oder Dateien hochzuladen.
4. Erstelle [[Druckjobs]] für Aufträge, die druckbereit sind.
