---
title: "Druckjob erstellen & verwalten"
description: "Schritt-für-Schritt: Job anlegen, Aufträge zuweisen, Filament erfassen, Status ändern"
icon: "Layers"
group: "Aufträge & Produktion"
order: 3.1
---

# Druckjob erstellen & verwalten

![Druckjobs Board-Ansicht](/wiki-screenshots/jobs-board.png)

## Neuen Job anlegen

1. Wechsle in der [[Druckjobs]]-Ansicht zur **Board-Ansicht** (Button oben rechts).
2. Klicke in der Spalte der gewünschten Maschine auf **+ Job**.
3. Ein Dialog öffnet sich — fülle die Felder aus:

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| **Maschine** | ja | 3D-Drucker, auf dem der Job läuft |
| **Geplanter Start** | ja | Datum und Uhrzeit des geplanten Druckbeginns |
| **Druckzeit (Minuten)** | nein | Voraussichtliche Druckdauer; wird für [[Druckjobs|Auto-Transition]] benötigt |
| **Notizen** | nein | Interne Hinweise für das Team |

4. Klicke **Erstellen** — der Job erscheint in der Maschinenspalte mit Status **Geplant**.

> Falls keine Maschinen vorhanden sind, muss zuerst eine Maschine unter [[Einstellungen → Maschinen|settings-machines]] angelegt werden.

## Aufträge einem Job zuweisen

Im Job-Detail (nach dem Erstellen oder per Klick auf einen Job):

1. Scrolle zum Abschnitt **Aufträge**.
2. Klicke **Auftrag hinzufügen**.
3. Suche nach Kurzcode oder Kundenname und wähle den gewünschten Auftrag.
4. Der Auftrag ist nun mit dem Job verknüpft — er erscheint im Job-Detail und im [[Auftrags-Detailansicht|orders-detail]] unter "Verknüpfte Druckjobs".

Ein Auftrag kann mehreren Jobs zugewiesen sein (z. B. wenn Teile auf verschiedene Drucker verteilt werden).

### Auftrag vom Job entfernen

Klicke im Job-Detail neben dem Auftrag auf das **×**-Symbol. Der Auftrag bleibt erhalten — nur die Verknüpfung wird gelöst.

## Filament-Verbrauch erfassen

Im Job-Detail unter **Filamente**:

1. Klicke **Filament hinzufügen**.
2. Wähle das Filament aus dem [[Inventar]] (Material und Farbe).
3. Trage die verbrauchte Menge in **Gramm** ein.
4. Klicke **Hinzufügen** — der Bestand im [[Inventar]] wird sofort aktualisiert.

Mehrere Filamente pro Job sind möglich (z. B. bei Mehrfarbdruck oder unterschiedlichen Teilen).

### Filament-Eintrag löschen

Klicke auf das Papierkorb-Symbol neben dem Eintrag. Der Lagerbestand wird entsprechend korrigiert.

## Status manuell ändern

Du kannst den Status eines Jobs jederzeit manuell überschreiben:

1. Öffne das Job-Detail (Klick auf den Job im Board oder in der Gantt-Ansicht).
2. Klicke auf **Status ändern** oder wähle im Aktions-Menü den gewünschten Status.

| Übergang | Wann sinnvoll |
|----------|---------------|
| Geplant → In Bearbeitung | Druck startet früher als geplant |
| In Bearbeitung → Fertig | Druck ist abgeschlossen, aber Auto-Transition hat noch nicht angesprungen |
| Fertig → In Bearbeitung | Fehldruck — Job muss wiederholt werden |

## Job bearbeiten

Klicke auf das **Bearbeiten**-Symbol (Stift) im Job-Detail, um Maschine, Startzeitpunkt oder Druckzeit nachträglich zu ändern.

> **Wichtig:** Das Ändern der Startzeit beeinflusst die Auto-Transition — der neue Zeitpunkt gilt als Referenz.

## Job löschen

1. Öffne das Job-Detail.
2. Klicke auf das **Aktions-Menü** (drei Punkte) oben rechts.
3. Wähle **Löschen**.

Das Löschen eines Jobs entfernt auch alle Auftragszuweisungen und Filament-Einträge. Die Aufträge und das Inventar bleiben davon unberührt (Bestand wird zurückgebucht).

## Job-Etiketten

Jeder Job hat einen sechsstelligen **Kurzcode** (z. B. `J4X9PL`), der für Etiketten verwendet wird. Du kannst nach einem Kurzcode suchen, indem du ihn oben in das **Job-ID-Suchfeld** eingibst.
