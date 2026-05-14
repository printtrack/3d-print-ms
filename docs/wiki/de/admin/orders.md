---
title: "Aufträge"
description: "Aufträge verwalten: Phasen ändern, Dateien hochladen, Kommentare, Audit-Log"
route: "/admin/orders"
icon: "ClipboardList"
group: "Aufträge & Produktion"
order: 2
---

# Aufträge

Unter **Aufträge** werden alle eingegangenen Bestellungen verwaltet. Jeder Auftrag durchläuft definierte Phasen von der Annahme bis zur Fertigstellung.

![Auftragsübersicht](/wiki-screenshots/orders.png)

## Auftragslistenansicht (`/admin/orders`)

Die Liste zeigt alle Aufträge mit Status, Kundenname, Datum und Dateianzahl.

- **Suche** — filtert nach Kundenname, E-Mail oder Auftragsnummer
- **Filter** — schränkt auf eine bestimmte Phase ein
- **Klick auf Auftrag** — öffnet die Detailansicht

## Auftrags-Detailansicht (`/admin/orders/[id]`)

### Phasen ändern

Wähle im Dropdown **Phase** die neue Phase. Der Wechsel wird gespeichert und im **Audit-Log** unten vermerkt.

### Dateien

- **Team-Dateien hochladen** — lade Design-Dateien (STL, OBJ, 3MF, Bilder) hoch, die dem Kunden bereitgestellt werden
- **Kunden-Dateien** — Dateien, die der Kunde beim Bestellen hochgeladen hat
- Unterstützte Formate: JPG, PNG, GIF, WebP, STL, OBJ, 3MF (max. 50 MB)

### 3D-Modell-Viewer

Klicke auf eine STL/OBJ/3MF-Datei, um sie direkt im Browser als 3D-Modell anzuzeigen. Im Viewer kannst du das Modell drehen, zoomen und **Notizen** an bestimmten Stellen markieren.

### Kommentare

Das Kommentarfeld am unteren Ende ist für interne Notizen des Teams — Kunden sehen diese nicht.

### Audit-Log

Jede Phasenänderung, jeder Datei-Upload und jeder Kommentar werden automatisch mit Zeitstempel und Benutzer protokolliert.

### Auftrag archivieren

Klicke **Archivieren** (Menü oben rechts), um einen abgeschlossenen Auftrag aus der aktiven Ansicht zu entfernen. Archivierte Aufträge bleiben in der Datenbank und können in der Liste über den Filter **Archiviert** eingeblendet werden.

## Zusammenhänge

- Phasen konfigurieren → [[Einstellungen]]
- Auftrag einem Druckjob zuweisen → [[Druckjobs]]
- Auftrag in ein Projekt einbinden → [[Projekte]]
