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

## Ausfall & Wartung

Jede Maschine hat links einen **Status-Punkt**: grün = in Betrieb, rot = ausgefallen, gelb = Wartung geplant. Anders als der Schalter *Aktiv* (dauerhaftes Ausmustern) bildet der Ausfall eine **vorübergehende** Nichtverfügbarkeit ab.

### Ausfall oder Wartung melden

1. Klicke bei der Maschine auf das **Schraubenschlüssel-Symbol** (*Ausfall / Wartung melden*).
2. Wähle den **Grund** (Defekt oder Wartung) und trage optional eine Notiz ein.
3. Für **geplante Wartung in der Zukunft** aktiviere *Wartung im Voraus planen* und gib einen geplanten Beginn an. Ohne Haken beginnt der Ausfall **sofort**.
4. Klicke **Als ausgefallen markieren**.

Solange eine Maschine ausgefallen ist, wird sie vom [[Druckjobs|Druckjob-Planner]] **nicht mehr vorgeschlagen** und geplante Jobs auf ihr werden **nicht automatisch gestartet**.

### Betroffene Jobs umplanen

Meldest du einen **sofortigen** Ausfall, öffnet sich direkt der **Umplanungs-Assistent**: Er listet die laufenden und geplanten Jobs auf der Maschine. Pro Job wählst du, ob er auf eine andere passende Maschine gelegt oder zurück ins Backlog (ungeplant) genommen wird. In der Timeline werden betroffene Jobs zusätzlich mit einem roten Rahmen und ⚠ markiert.

### Wieder verfügbar machen

Ist die Reparatur oder Wartung abgeschlossen, klicke **Wieder verfügbar**. Der Ausfall wird mit Endzeitpunkt abgeschlossen und die Maschine steht sofort wieder zur Verfügung. Eine Reparaturdauer musst du nie vorab schätzen.

### Ausfall-Historie

Über den **Pfeil** neben einer Maschine klappst du die **Ausfall-Historie** auf — alle vergangenen und laufenden Ausfälle mit Grund, Zeitraum und Notiz. Diese Historie ist die Grundlage für spätere Auslastungs- und Effektivitätsstatistiken.

## Maschine löschen

Klicke auf das **Papierkorb-Symbol**. Eine Maschine kann nur gelöscht werden, wenn ihr **keine aktiven Jobs** mehr zugeordnet sind. Schließe oder entferne die Jobs zuerst.
