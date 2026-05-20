---
title: "Aufträge"
description: "Auftragsübersicht: suchen, filtern, nach Phase sortieren"
route: "/admin/orders"
icon: "ClipboardList"
group: "Aufträge & Produktion"
order: 2
---

# Aufträge

Unter **Aufträge** werden alle eingegangenen Bestellungen verwaltet. Jeder Auftrag durchläuft definierte Phasen von der Annahme bis zur Fertigstellung.

![Auftragsübersicht](/wiki-screenshots/orders.png)

## Auftragslistenansicht

Die Liste zeigt alle aktiven Aufträge mit folgenden Spalten:

| Spalte | Inhalt |
|--------|--------|
| **Kurzcode** | Eindeutige Auftragsnummer (z. B. `A7F3`) — wird auch auf Etiketten gedruckt |
| **Kunde** | Name und E-Mail-Adresse |
| **Phase** | Aktuelle Phase mit farbiger Markierung |
| **Teile** | Anzahl der Einzelteile im Auftrag |
| **Dateien** | Anzahl hochgeladener Dateien (Kunden- und Team-Dateien) |
| **Datum** | Eingang des Auftrags |

## Suche und Filter

- **Suchfeld** — filtert in Echtzeit nach Kundenname, E-Mail oder Kurzcode
- **Phasen-Filter** — schränkt die Liste auf eine bestimmte Phase ein; mehrere Phasen sind kombinierbar
- **Archiviert-Toggle** — blendet archivierte Aufträge ein oder aus (standardmäßig ausgeblendet)

## Auftrag öffnen

Klicke auf eine Zeile, um in die [[Auftrags-Detailansicht]] zu wechseln.

## Neuen Auftrag anlegen

Aufträge werden vom Kunden über das öffentliche Auftragsformular (`/`) eingereicht. Admins können keinen Auftrag direkt im Backend anlegen — das sichert eine vollständige Kundeneingabe.

## Subseiten

- [[Auftrags-Detailansicht]] — Phase ändern, Dateien, Aktivitäts-Tabs (Kommentare, Verlauf, Kundenkontakt)
- [[3D-Viewer & Druckorientierung]] — Modelle im Browser öffnen, Orientierung festlegen
