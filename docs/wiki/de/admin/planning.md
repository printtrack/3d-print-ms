---
title: "Planung"
description: "Auslastungs-, Monats- und Agenda-Ansicht für Aufträge, Meilensteine, Termine und Web-Kalender"
route: "/admin/planning"
icon: "CalendarRange"
group: "Planung & Ressourcen"
order: 5
---

# Planung

Die Planung führt Auftrags-Liefertermine, Meilensteine, selbst angelegte Termine **und** abonnierte Web-Kalender in einer einzigen Oberfläche zusammen. Sie beantwortet die Frage „wer arbeitet woran und was ist wann fällig".

![Planungsübersicht](/wiki-screenshots/planning.png)

## Drei Ansichten

Oben links wechselst du zwischen den Ansichten:

- **Auslastung** — Zeitleiste über 5 Wochen, eine Zeile pro Teammitglied. Aufträge erscheinen als Balken über ihren Zeitraum (Anlage → Liefertermin), Meilensteine als Rauten direkt auf dem zugehörigen Auftragsbalken. So siehst du sofort, wer ausgelastet ist.
- **Monat** — klassisches Monatsraster mit durchgehenden Mehrtagesbalken und Meilenstein-Rauten.
- **Agenda** — chronologische Liste, Tag für Tag. Überfällige Einträge werden oben in einer eigenen Gruppe gebündelt.

Ein Klick auf einen Balken, eine Raute oder eine Agenda-Zeile öffnet rechts ein **Detail-Panel** mit allen Infos; bei Aufträgen führt „Auftrag öffnen" direkt zur Auftragsdetailseite.

## Werkzeugleiste

- **Suche** — filtert nach Auftrag, Kunde oder Bearbeiter.
- **Navigation** (‹ ›, „Heute") — blättert wochen- bzw. monatsweise.
- **Überfällig-Pill** — springt direkt zur Agenda mit allen überfälligen Einträgen.
- **Ansicht** — blendet Erledigte, Kundennamen oder Auslastungszähler aus.
- **Legende** — jeder Chip (Phase, Meilenstein, Termin, Web-Kalender) lässt sich anklicken, um diese Kategorie ein-/auszublenden.

## Allgemeine Termine anlegen

Über **„Termin anlegen"** (oben rechts) erstellst du Termine **ohne Auftragsbezug** — z. B. Druckerwartung, Messe, Urlaub oder Meetings. Ein Termin kann ganztägig oder über einen Zeitraum laufen und optional einem Teammitglied zugeordnet werden (dann erscheint er in dessen Auslastungszeile). Auftrags-Liefertermine und Meilensteine entstehen dagegen automatisch aus den Aufträgen und müssen nicht manuell gepflegt werden.

## Web-Kalender einbinden (Ferienkalender & Co.)

Externe iCal/ICS-Kalender — etwa Schulferien- oder Feiertagskalender — lassen sich abonnieren und erscheinen **schreibgeschützt** in allen drei Ansichten (jeweils in der Farbe des Kalenders, als eigene Zeile in der Auslastung).

Verwaltet werden die Abos shop-weit unter **Einstellungen → Web-Kalender** (nur Admins, direkt neben [[Einstellungen → Maschinen|settings-machines]]):

1. **Kalender hinzufügen** klicken.
2. Name, die öffentliche **iCal/ICS-URL** (`https://…` oder `webcal://…`) und eine Farbe eintragen.
3. Beim Speichern wird der Kalender einmal testweise abgerufen — ist er nicht erreichbar oder keine gültige iCal-Datei, wird das Anlegen mit einer Fehlermeldung abgelehnt.

Abonnierte Kalender werden im Hintergrund alle 15 Minuten aktualisiert; die Zeile zeigt „Zuletzt aktualisiert" und im Fehlerfall die letzte Fehlermeldung. Deaktiviere einen Kalender über den Schalter, ohne ihn zu löschen.

## Tipps für die tägliche Nutzung

- Starte den Tag mit der **Agenda** — überfällige Einträge stehen ganz oben.
- Nutze die **Auslastung**, um vor der Vergabe eines neuen Auftrags freie Kapazitäten im Team zu erkennen.
- Binde einen **Feiertags-/Ferienkalender** ein, damit Brücken- und Urlaubstage bei der Terminzusage sichtbar sind.
