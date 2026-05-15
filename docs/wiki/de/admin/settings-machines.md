---
title: "Einstellungen → Maschinen"
description: "3D-Drucker anlegen, Bauvolumen konfigurieren und Stundensatz hinterlegen"
route: "/admin/settings?tab=maschinen"
icon: "Printer"
group: "Wissen & Verwaltung"
order: 9.4
---

# Maschinen verwalten

![Einstellungen Maschinen](/wiki-screenshots/settings-machines.png)

Unter dem Tab **Maschinen** pflegst du die Liste der verfügbaren 3D-Drucker. Nur hier angelegte Maschinen können [[Druckjobs]] zugewiesen werden.

## Maschine anlegen

1. Klicke auf **+ Maschine hinzufügen**.
2. Fülle die Pflichtfelder aus (Name, Bauvolumen).
3. Ergänze optionale Felder (Modell, Stundensatz, Notizen).
4. Klicke **Speichern**.

Die Maschine ist sofort verfügbar und kann neuen Jobs zugewiesen werden.

## Felder

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| **Name** | ja | Interner Bezeichner (z. B. "Bambu X1 Carbon #1") |
| **Modell** | nein | Hersteller und Modell (z. B. "Bambu Lab X1 Carbon") |
| **Bauvolumen X** | ja | Breite des Druckraums in mm |
| **Bauvolumen Y** | ja | Tiefe des Druckraums in mm |
| **Bauvolumen Z** | ja | Höhe des Druckraums in mm |
| **Stundensatz (€/h)** | nein | Wird für zukünftige Kostenkalkulationen verwendet |
| **Notizen** | nein | Freitext für Besonderheiten (z. B. spezielle Filamentanforderungen) |
| **Aktiv** | — | Inaktive Maschinen tauchen bei neuen Jobs nicht auf |

## Bauvolumen und Druckjob-Planner

Das Bauvolumen ist **entscheidend für den automatischen Druckjob-Planner**. Der Planner berechnet, wie viele Teile gleichzeitig auf die Druckplatte passen, und prüft dabei:

1. Footprint jedes Teils (Breite × Tiefe der Bounding Box) gegen das Bauvolumen X × Y der Maschine
2. Höhe des Teils gegen Bauvolumen Z

Wenn du das Bauvolumen falsch einträgst, schlägt der Planner Kombinationen vor, die physisch nicht möglich sind.

## Maschine bearbeiten

Klicke auf das **Stift-Symbol** neben der Maschine, ändere die Felder und klicke **Speichern**.

## Maschine deaktivieren

Setze den Schalter **Aktiv** auf Aus. Die Maschine bleibt in der Liste sichtbar und historische Jobs bleiben erhalten — sie wird nur bei neuen Jobs nicht mehr zur Auswahl angeboten.

## Maschine löschen

Klicke auf das **Papierkorb-Symbol**. Eine Maschine kann nur gelöscht werden, wenn ihr **keine aktiven Jobs** mehr zugeordnet sind. Schließe oder entferne die Jobs zuerst.
