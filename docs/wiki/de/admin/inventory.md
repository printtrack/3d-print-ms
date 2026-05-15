---
title: "Inventar"
description: "Filament-Lagerbestand überwachen, Bestände erfassen und Verbrauch nachverfolgen"
route: "/admin/inventory"
icon: "Package"
group: "Planung & Ressourcen"
order: 6
---

# Inventar

Das Inventar verwaltet den aktuellen Filament-Lagerbestand. Der Bestand wird automatisch reduziert, wenn [[Druckjob erstellen & verwalten|jobs-create|Druckjobs]] mit Filament-Verbrauch abgeschlossen werden.

![Inventar Übersicht](/wiki-screenshots/inventory.png)

## Lagerbestand anzeigen

Die Inventarliste zeigt alle eingetragenen Filamente mit:

| Spalte | Inhalt |
|--------|--------|
| **Farbe** | Farbvorschau und Name |
| **Material** | z. B. PLA, PETG, ABS, ASA, TPU |
| **Restmenge** | Aktueller Bestand in Gramm |
| **Mindestbestand** | Schwellwert für Nachbestellungs-Hinweis |
| **Lieferant** | Optionaler Lieferantenname |
| **Charge** | Optionale Charge-/LOT-Nummer |

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

## Automatischer Verbrauch aus Druckjobs

Wenn du in einem [[Druckjob erstellen & verwalten|jobs-create]] Filament-Verbrauch erfasst, wird die entsprechende Menge **sofort** vom Bestand abgezogen. Beim Löschen eines Filament-Eintrags im Job wird der Bestand entsprechend zurückgebucht.

## Nachbestellungs-Hinweis

Filamente, deren Restmenge **unter dem eingestellten Mindestbestand** liegt, werden **rot hervorgehoben**. So siehst du auf einen Blick, welche Materialien nachbestellt werden müssen.

Wenn kein Mindestbestand eingetragen ist, gibt es keinen Hinweis — auch bei 0 g Restmenge.

## Filament löschen

Klicke auf das **Papierkorb-Symbol** neben dem Filament. Filamente, die in aktiven Jobs referenziert werden, können nicht gelöscht werden — entferne zuerst die Verbrauchseinträge in den betroffenen Jobs.
