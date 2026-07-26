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
| **Materialplätze** | ja | Wie viele Filamente der Drucker gleichzeitig geladen hat (1 = Einzelextruder, 4 = AMS/MMU …) |
| **Geladenes Filament** | nein | Welche Spule aktuell in welchem Platz steckt — nur beim Bearbeiten sichtbar |
| **Stundensatz (€/h)** | nein | Wird für zukünftige Kostenkalkulationen verwendet |
| **Notizen** | nein | Freitext für Besonderheiten (z. B. spezielle Filamentanforderungen) |
| **Aktiv** | — | Inaktive Maschinen tauchen bei neuen Jobs nicht auf |

## Bauvolumen und Druckjob-Planner

Das Bauvolumen ist **entscheidend für den automatischen Druckjob-Planner**. Der Planner berechnet, wie viele Teile gleichzeitig auf die Druckplatte passen, und prüft dabei:

1. Footprint jedes Teils (Breite × Tiefe der Bounding Box) gegen das Bauvolumen X × Y der Maschine
2. Höhe des Teils gegen Bauvolumen Z

Wenn du das Bauvolumen falsch einträgst, schlägt der Planner Kombinationen vor, die physisch nicht möglich sind.

## Materialplätze und Filamentwechsel

Die **Materialplätze** sagen dem Planer, wie viele verschiedene Filamente gleichzeitig im Drucker stecken:

- **1 Platz (Standard, Einzelextruder):** Ein Druckjob enthält immer genau ein Filament. Braucht der nächste Job eine andere Spule, ist ein Filamentwechsel fällig.
- **Mehrere Plätze (AMS/MMU):** Der Planer darf Teile verschiedener Farben in einen Job legen, solange die Anzahl der Plätze reicht.

Das **geladene Filament** je Platz ist der Ausgangszustand für die Wechsel-Erkennung. Trag hier ein, was gerade wirklich im Drucker steckt — danach pflegt PrintTrack den Zustand selbst: Jedes Mal, wenn du bei einem Druckjob **Wechsel erledigt** bestätigst, werden die Plätze auf die Spulen dieses Jobs gesetzt.

> Solange ein fälliger Filamentwechsel nicht bestätigt ist, startet der betroffene [[Druckjob|jobs]] nicht, sondern wird nach hinten geschoben.

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

## Anbindung an den Drucker

Damit ein [[Druckjobs|Druckjob]] direkt an den Drucker geschickt werden kann, hinterlegst du im Maschinen-Editor die **Anbindung an den Drucker**. Öffne eine Maschine über das **Stift-Symbol** und wähle zuerst die **Firma**, dann das **Modell**:

- **Keine** — Maschine ist nur zur Planung da, kein Versand an Hardware.
- **Prusa → CORE One (Connect/Cloud)** — Anbindung über die **Prusa-Connect-Cloud** (genau der Weg, den auch OrcaSlicer/PrusaSlicer nutzen). Von überall erreichbar, **kein VPN nötig**. Du trägst nur den **Prusa Connect API-Key** ein, den du in Prusa Connect unter Drucker → Einstellungen → *API keys* erzeugst.
- **Prusa → CORE One (PrusaLink/lokal)** — Alternative über **PrusaLink** (lokale Drucker-API) für Betrieb im gleichen Netz. Du trägst die **Drucker-Adresse** (z. B. `http://192.168.1.50`) und den **PrusaLink API-Key** ein.
- **Ultimaker → S3** — Anbindung über die **Ultimaker Digital Factory** (Cloud). Du trägst **Zugangs-Token** und **Cluster-/Drucker-ID** ein, optional eine **Basis-URL**.
- **Test → Mock-Drucker** — simulierter Drucker zum Ausprobieren ohne echte Hardware; du wählst den **simulierten Zustand** (z. B. *Bereit* oder *Druckt*).

Über das **Firma + Modell**-Prinzip lassen sich später weitere Drucker ergänzen, ohne die Bedienung zu ändern — es kommt einfach ein neues Modell in die Auswahl.

Zugangsdaten (API-Key/Token) werden **verschlüsselt** gespeichert und **nie** wieder im Klartext angezeigt — beim Bearbeiten leer lassen bedeutet „unverändert".

> **Cloud oder lokal:** Ultimaker und die Prusa-**Connect**-Variante laufen über die Hersteller-Cloud und sind auch von außerhalb des Druckernetzes erreichbar. Die Prusa-**PrusaLink**-Variante spricht den Drucker direkt lokal an — dafür muss der Server den Drucker im Netz erreichen (gleiches Netz, VPN oder Tunnel).

### Verbindung testen

Klicke **Verbindung testen**. Das System speichert die eingegebenen Daten und fragt einmal den Druckerzustand ab. Bei Erfolg erscheint der gemeldete Zustand (z. B. *Bereit*), und in der Maschinenliste zeigt ein **Drucker-Badge** den zuletzt gesehenen Zustand.

Wie ein Job an den Drucker geschickt und gestartet wird, steht unter [[Druckjobs|jobs]] → **An Drucker senden**.

## Maschine löschen

Klicke auf das **Papierkorb-Symbol**. Eine Maschine kann nur gelöscht werden, wenn ihr **keine aktiven Jobs** mehr zugeordnet sind. Schließe oder entferne die Jobs zuerst.
