---
title: "Projekte"
description: "Vorhaben jenseits einzelner Druckaufträge bündeln: Sprint-Roadmap, Dateien mit eigenen Phasen, interne Kommentare und Gantt-Ansicht"
route: "/admin/projects"
icon: "FolderKanban"
group: "Aufträge & Produktion"
order: 4
---

# Projekte

Projekte bündeln Vorhaben, die **nicht direkt ein einzelner Druckauftrag** sind — etwa eine Eventplanung, ein Messestand oder eine größere Baugruppe aus vielen Einzelteilen. Sie verknüpfen optional mehrere [[Aufträge]] und ergänzen sie um eigene Planung, Dateien und Kommunikation.

![Projekte Übersicht](/wiki-screenshots/projects.png)

## Wofür sind Projekte?

Immer dann, wenn etwas mehr als ein reiner Druckauftrag ist. Ein Projekt hat eine eigene Roadmap, eigene Dateien und einen internen Kommentar-Verlauf — unabhängig davon, ob (und wie viele) Aufträge daran hängen.

**Typische Anwendungsfälle:**
- Eventplanung oder Messestand mit vielen Arbeitsschritten
- Verschiedene Komponenten einer Baugruppe
- Mehrere Prototypen-Iterationen desselben Teils
- Aufträge mehrerer Kunden für ein gemeinsames Vorhaben

## Neues Projekt erstellen

1. Klicke **+ Neues Projekt**.
2. Vergib einen **Namen** und optionale **Beschreibung**.
3. Wähle eine **Projektphase** (Standard: erster Eintrag in [[Einstellungen → Phasen|settings-phases]]).
4. Klicke **Erstellen**.

## Projekt-Detailansicht

Oben sitzt eine **fixierte Kopfzeile** (sticky), die beim Scrollen sichtbar bleibt. Sie zeigt:

- **Name + Phasen-Chip** — klicke den farbigen Chip, um die Projektphase direkt zu wechseln
- **Deadline** — mit „Überfällig"-Markierung, wenn das Datum überschritten ist
- **Zugewiesene** — die Team-Mitglieder als Avatare

## Sprint-Roadmap & Meilensteine

Jedes Projekt hat eine **Roadmap** mit Sprints und Meilensteinen — dieselbe Funktion wie in der Auftrags-Detailansicht:

1. Lege über **+** einen **Sprint** an (z. B. eine Projektphase oder ein Arbeitspaket).
2. Füge je Sprint **Meilensteine** mit Namen und Fälligkeitsdatum hinzu.
3. Jeder Meilenstein kann **Aufgaben** enthalten; der Fortschritt wird als Balken angezeigt.

Das Fälligkeitsdatum muss zwischen Erstelldatum und Deadline des Projekts liegen.

## Projektdateien

Im Projekt-Detail kannst du **Dateien hochladen** (per Klick oder Drag & Drop). Anders als Auftragsdateien durchlaufen Projektdateien **eigene, frei konfigurierbare Dateiphasen** (z. B. *Entwurf → In Prüfung → Final*):

- Jede Datei bekommt beim Upload automatisch die **Standard-Dateiphase**.
- Über das Auswahlmenü pro Datei änderst du die Phase jederzeit.
- Dateien lassen sich herunterladen oder löschen.

Die Dateiphasen werden unter [[Einstellungen|settings]] im Tab **Projekt-Dateiphasen** verwaltet (anlegen, umbenennen, Farbe, Reihenfolge, Standard).

## Interne Kommentare

Der Kommentar-Bereich ist eine **rein interne** Team-Kommunikation zum Projekt. Es gibt — anders als bei Aufträgen — **keinen** Versand an Kunden; externe Kommunikation läuft über separate Kanäle.

## Aufträge zum Projekt hinzufügen

In der Seitenleiste des Projekt-Details:

1. Klicke auf **Verknüpfen**.
2. Suche nach Kurzcode oder Kundenname.
3. Wähle den gewünschten Auftrag — er erscheint in der Projektliste.

Über das **Verknüpfung-entfernen**-Symbol löst du die Zuordnung wieder. Verknüpfte Aufträge behalten ihre **eigene** Roadmap zusätzlich zur Projekt-Roadmap.

## Projektphase ändern

Klicke auf den Phasen-Chip in der Kopfzeile und wähle eine neue Phase. Projektphasen werden unter [[Einstellungen → Phasen|settings-phases]] konfiguriert.

## Gantt-Ansicht

In der Projekt-Übersicht zeigt die **Gantt**-Ansicht die enthaltenen Aufträge als horizontale Balken auf einem Zeitstrahl — nützlich, um Abhängigkeiten und den zeitlichen Ablauf zu erkennen.

## Projekt archivieren oder löschen

- **Archivieren** — das Projekt verschwindet aus der aktiven Liste; Aufträge und Daten bleiben erhalten
- **Löschen** — permanent; entfernt das Projekt samt Dateien und Kommentaren, aber nicht die verknüpften Aufträge
