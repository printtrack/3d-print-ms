---
title: "Inventar"
description: "Filament-Lagerbestand überwachen, Bestände erfassen und Verbrauch nachverfolgen"
route: "/admin/inventory"
icon: "Package"
group: "Planung & Ressourcen"
order: 6
---

# Inventar

Das Inventar verwaltet den aktuellen Filament-Lagerbestand. Der physische Bestand wird reduziert, sobald ein Teil im Job verifiziert (gewogen) wurde. Solange Jobs nur **geplant** oder am Drucken sind, gilt ihr Filament-Bedarf als **eingeplant** und vermindert den **verfügbaren** Bestand.

![Inventar Übersicht](/wiki-screenshots/inventory.png)

## Verfügbar vs. Eingeplant vs. Bestand

Drei verwandte Größen, die im Inventar getrennt angezeigt werden:

| Größe | Bedeutung |
|-------|-----------|
| **Bestand** | Wieviel Filament physisch da ist. Nur durch Verifikation (Teil gewogen) und manuelle Korrektur veränderlich. |
| **Eingeplant** | Summe der geschätzten Mengen aller aktiven Jobs (PLANNED/SLICED/IN_PROGRESS/AWAITING_VERIFICATION), die dieses Filament nutzen. Stammt aus G-Code-Daten (falls vorhanden) oder aus `gramsEstimated` der Teile. |
| **Verfügbar** | `Bestand − Eingeplant`. Kann negativ werden, wenn mehr Jobs geplant sind als Filament vorhanden ist — die Zeile wird dann rot markiert. |

## Lagerbestand anzeigen

Die Inventarliste zeigt alle eingetragenen Filamente mit:

| Spalte | Inhalt |
|--------|--------|
| **Farbe** | Farbvorschau und Name |
| **Material** | z. B. PLA, PETG, ABS, ASA, TPU |
| **Verfügbar** | Was nach Abzug aller eingeplanten Jobs noch frei ist. Rot bei Überzug. |
| **Eingeplant** | Reservierte Menge aus aktiven Jobs |
| **Bestand** | Physisch vorhandene Menge / Spulengröße |
| **Preis** | Optionaler Preis pro kg |

## Filament hinzufügen

1. Klicke **+ Filament**.
2. Wähle **Material** und **Farbe** aus (oder gib eine eigene Farbe ein).
3. Trage die **Anfangsmenge in Gramm** ein (z. B. 1000 g für eine 1-kg-Spule).
4. Optional: **Mindestbestand**, **Lieferant** und **Charge** eintragen.
5. Klicke **Speichern**.

## Bestand manuell anpassen

Klicke auf ein Filament, um die Menge direkt zu bearbeiten — zum Beispiel nach einer Inventur oder wenn eine neue Spule hinzugekommen ist.

**Typische Anwendungsfälle:**
- Neue Spule geliefert → Bestand um 1000 g erhöhen
- Filament bei Test/Kalibrierung verbraucht → Bestand manuell senken
- Inventur ergab Abweichung → Bestand korrigieren

## Reservierung & echter Verbrauch

- **Beim Planen eines Jobs** (Status PLANNED) wird das benötigte Filament als **eingeplant** gekennzeichnet — der Bestand selbst bleibt unverändert.
- **Beim Verifizieren eines Teils** (Stück gewogen) wird die gemessene Menge vom Bestand abgezogen. Erst dann sinkt der reale Lagerbestand.
- Wird ein Job auf DONE/CANCELLED gesetzt, fällt seine Reservierung weg.

So lässt sich die Auslastung des Filaments vorausplanen, ohne dass die Buchhaltung Schaden nimmt: was nicht gedruckt wurde, gilt auch nicht als verbraucht.

## Überzugs-Warnung beim Planen

Im [[Druckjobs vorschlagen|jobs|Jobs-Vorschlagsdialog]] wird pro vorgeschlagenem Job geprüft, ob der verfügbare Bestand für das benötigte Filament ausreicht. Reicht er nicht, erscheint eine rote Warnung an der Job-Zeile. Beim Klick auf **Erstellen** öffnet sich ein Bestätigungsdialog mit der Liste der betroffenen Filamente — du kannst die Jobs trotzdem planen (z. B. wenn Nachschub kurzfristig erwartet wird).

## Wenig-Bestand-Hinweis

Liegt der verfügbare Bestand unter 250 g (aber noch nicht negativ), wird das Filament gelb hervorgehoben. Bei negativem Verfügbar-Wert ist die Anzeige rot.

## Filament löschen

Klicke auf das **Papierkorb-Symbol** neben dem Filament. Filamente, die in aktiven Jobs referenziert werden, können nicht gelöscht werden — entferne zuerst die Verbrauchseinträge in den betroffenen Jobs.
