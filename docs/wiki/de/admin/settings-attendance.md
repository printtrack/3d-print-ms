---
title: "Einstellungen → Anwesenheitszeiten"
description: "Wann jemand vor Ort ist — Grundlage für Start, Filamentwechsel und Entnahme"
route: "/admin/settings?tab=anwesenheit"
icon: "CalendarClock"
group: "Wissen & Verwaltung"
order: 9.5
---

# Anwesenheitszeiten

Drucker laufen rund um die Uhr, Menschen nicht. Unter **Einstellungen → Anwesenheitszeiten** legst du fest, wann jemand vor Ort ist. Die [[automatische Druckplanung|jobs]] plant daraufhin so, dass alles, wofür man am Drucker stehen muss, in diese Zeiten fällt:

- **Filamentwechsel**
- **Fertiges Teil entnehmen**

Der Druck selbst darf beliebig durchlaufen — auch nachts und übers Wochenende. Und weil sich Drucke **per Fernzugriff starten** lassen, darf auch der Start außerhalb der Anwesenheit liegen, solange kein Filamentwechsel nötig ist.

## Einrichten

1. Häkchen bei **Anwesenheitszeiten berücksichtigen** setzen. Ohne Häkchen plant PrintTrack wie bisher rund um die Uhr.
2. Pro Wochentag Beginn und Ende eintragen. Ein Tag ohne Häkchen heißt „niemand vor Ort".
3. **Speichern**.

> Beispiel: Mo–Fr 08:00–18:00. Ein Druck, der Freitag um 16:00 startet und 30 Stunden läuft, ist Samstagnacht fertig — entnommen wird er aber erst Montag um 08:00. Bis dahin ist der Drucker belegt, denn die Platte liegt noch drauf. Genau so plant PrintTrack den nächsten Job auf diesem Drucker.

## Auswirkung auf die Zeitachse

Auf der [[Druckjobs|jobs]]-Zeitachse werden unbetreute Zeiten als graues Band hinterlegt. Zusätzlich zeigt jeder Job, wie lange der Drucker über die reine Druckzeit hinaus belegt ist:

- Gelbe Schraffur davor: ausstehender Filamentwechsel (Rüstzeit)
- Graue Schraffur danach: fertig, aber die Platte liegt noch drauf

## Grenzen

- Die Zeiten gelten **für den ganzen Betrieb**, nicht je Drucker.
- Feiertage und Urlaub kennt der Wochenplan nicht — dafür meldest du den betroffenen Drucker unter [[Einstellungen → Maschinen|settings-machines]] als Ausfall.
