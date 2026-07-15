---
title: "Feedback & Bug-Reports (Beta)"
description: "Direkt aus der Oberfläche Fehler und Verbesserungen melden – optional mit Screenshot und automatischem GitHub-Issue"
route: "/admin/feedback"
icon: "MessageSquarePlus"
group: "Wissen & Verwaltung"
order: 10
---

# Feedback & Bug-Reports (Beta)

Während der Betaphase kann jedes Team-Mitglied direkt aus der Admin-Oberfläche Fehler und Verbesserungsvorschläge melden – ohne die Anwendung zu verlassen. Aus jeder Meldung kann automatisch ein GitHub-Issue entstehen, sodass nichts verloren geht.

![Feedback-Übersicht](/wiki-screenshots/feedback.png)

## Der Feedback-Button

Solange der **Beta-Modus** aktiv ist (Einstellungen → Module → Beta), erscheint unten rechts auf jeder Admin-Seite ein runder **Feedback-Button**. Ein Klick öffnet den Melde-Dialog:

1. **Art wählen:** *Fehler* (etwas funktioniert nicht) oder *Verbesserung* (Idee/Wunsch).
2. **Titel & Beschreibung:** Kurz zusammenfassen und beschreiben, was passiert ist, was du erwartet hast und wie man es nachstellt.
3. **Aktuelle Seite aufnehmen (optional):** Ein Klick auf „Aktuelle Seite aufnehmen" erstellt ohne weitere Nachfrage einen Screenshot der aktuellen Ansicht – es ist **keine Bildschirmfreigabe nötig**. Der Dialog blendet sich für die Aufnahme kurz aus, damit er nicht im Bild ist. Anschließend kannst du mit der Maus direkt im Screenshot einzeichnen, **wo genau** das Problem liegt.
4. **Absenden:** Die Meldung wird gespeichert. Ist die GitHub-Anbindung eingerichtet, wird sofort ein Issue angelegt und du bekommst einen Link dorthin.

Aktuelle Seite (URL) und Browser-Informationen werden automatisch mitgeschickt – das erspart Rückfragen.

## Die Triage-Ansicht

Unter **Feedback** in der Navigation (nur für Admins, nur im Beta-Modus sichtbar) laufen alle Meldungen zusammen. Für jede Meldung siehst du Art, Titel, Beschreibung, Melder, Zeitpunkt, den markierten Screenshot und – falls vorhanden – den Link zum GitHub-Issue.

Jede Meldung hat einen **Status**, den du hier setzt:

| Status | Bedeutung |
|--------|-----------|
| **Neu** | Frisch eingegangen, noch nicht gesichtet |
| **In Arbeit** | Wird gerade bearbeitet |
| **Erledigt** | Behoben bzw. umgesetzt |
| **Verworfen** | Kein Handlungsbedarf |

Über den Status-Filter oben rechts blendest du gezielt einzelne Status ein. Meldungen lassen sich hier auch löschen.

## GitHub-Anbindung einrichten

Die Issue-Erstellung ist optional. Sie ist aktiv, sobald zwei Umgebungsvariablen gesetzt sind:

- `GITHUB_TOKEN` – ein Personal Access Token mit Schreibrecht auf Issues (classic: Scope `repo`; fine-grained: *Issues → Read and write*).
- `GITHUB_REPO` – das Ziel-Repository im Format `owner/repo`.

Ohne diese Variablen wird das Feedback trotzdem in der Datenbank gespeichert und erscheint in der Triage-Ansicht – es geht also nie verloren.

## Beta-Modus abschalten

Ist die Betaphase vorbei, deaktivierst du den Beta-Modus unter **Einstellungen → Module → Beta**. Dann verschwinden sowohl der schwebende Feedback-Button als auch der Navigations-Eintrag „Feedback". Bereits gesammelte Meldungen bleiben in der Datenbank erhalten.
