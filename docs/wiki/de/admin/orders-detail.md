---
title: "Auftrags-Detailansicht"
description: "Phase ändern, Teile verwalten, Dateien, Aktivitäts-Tabs (Kommentare, Verlauf, Kundenkontakt)"
icon: "ClipboardList"
group: "Aufträge & Produktion"
order: 2.1
---

# Auftrags-Detailansicht

Die Detailansicht öffnet sich, wenn du in der [[Aufträge|Auftragsliste]] auf einen Eintrag klickst. Sie enthält alle Informationen und Aktionen für einen einzelnen Auftrag.

## Kopfbereich

Oben findest du die wichtigsten Eckdaten auf einen Blick:

- **Kurzcode** — eindeutige Auftragsnummer (z. B. `A7F3`), auch für Etiketten verwendet
- **Eingangs- und Änderungsdatum**
- **Aktuelle Phase** mit Farbmarkierung
- **Aktions-Menü** (oben rechts, drei Punkte) für Archivieren u. ä.

## Phase ändern

1. Wähle im Dropdown **Phase** die neue Phase aus.
2. Die Änderung wird sofort gespeichert — ein Eintrag im [[Audit-Log]] wird automatisch angelegt.
3. Wenn für diese Phase eine E-Mail-Vorlage konfiguriert ist, erhält der Kunde automatisch eine Benachrichtigung.

> Phasen werden unter [[Einstellungen → Phasen|settings-phases]] konfiguriert.

## Auftragstyp

Neben der Phase zeigt der Kopfbereich ein **Auftragstyp-Chip**. Es unterscheidet, was der Kunde beim Einreichen ausgewählt hat:

- **Nur Druck** — Der Kunde hat bereits ein fertiges Modell (z. B. von Printables, MakerWorld oder Thingiverse) und möchte es nur gedruckt haben.
- **Design** — Der Kunde benötigt ein eigenes Design oder eine Anpassung durch das Team.

Diese Kennzeichnung hilft bei der Planung (reiner Druck vs. Design-Aufwand) und wird auch als Badge auf der [[Aufträge|Kanban-Karte]] angezeigt.

Sollte der Kunde sich vertan haben, kannst du den Typ direkt über das Chip umstellen — die Änderung wird sofort gespeichert und im [[Audit-Log]] vermerkt.

### Modell-Links

Bei Aufträgen vom Typ **Nur Druck** kann der Kunde direkt Links zu den gewünschten Modellen angeben. Diese erscheinen in der **Beschreibungs-Karte** als anklickbare Chips und öffnen die Quelle in einem neuen Tab — so kommst du mit einem Klick zum Original-Modell.

## Beauftragte (Assignees)

Du kannst einen oder mehrere Bearbeiter dem Auftrag zuweisen:

1. Klicke auf **Beauftragte** im Seitenbereich.
2. Wähle Teammitglieder aus der Dropdown-Liste.
3. Die Zuweisung ist nur intern sichtbar — Kunden sehen sie nicht.

## Teile (Parts)

Komplexe Aufträge bestehen aus mehreren Einzelteilen. Im Abschnitt **Teile** verwaltest du diese:

- **Teil hinzufügen** — Klicke auf `+ Teil`, vergib Name und optionale Menge.
- **Teilphase** — Jedes Teil hat eine eigene Phase (z. B. Design → Überprüfung → Druckbereit → Gedruckt). Teilphasen werden unter [[Einstellungen → Phasen|settings-phases]] konfiguriert.
- **Teildateien** — Du kannst STL/3MF-Dateien direkt einem bestimmten Teil zuordnen.
- **Beauftragte pro Teil** — Ein einzelnes Teil kann einem spezifischen Teammitglied zugewiesen werden.

## Dateien

### Kunden-Dateien

Dateien, die der Kunde beim Einreichen des Auftrags hochgeladen hat. Diese können im [[3D-Viewer & Druckorientierung|orders-3dviewer]] geöffnet werden.

### Team-Dateien hochladen

1. Klicke auf **Datei hochladen** im Dateien-Abschnitt.
2. Wähle eine oder mehrere Dateien aus (JPG, PNG, GIF, WebP, STL, OBJ, 3MF — max. 50 MB je Datei).
3. Die Dateien sind anschließend für das gesamte Team sichtbar, nicht für den Kunden.

### Dateien herunterladen oder löschen

- **Download** — Klicke auf den Dateinamen.
- **Löschen** — Klicke auf das Papierkorb-Symbol neben der Datei. Diese Aktion ist unwiderruflich.

## Aktivität

Die Aktivitäts-Karte am unteren Ende des Hauptbereichs fasst alle Kommunikation und Änderungen in einem einzigen Ort zusammen — mit vier Tabs:

### Tab: Alle

Zeigt einen chronologischen Mix aus internen Kommentaren, Kundennachrichten und Audit-Einträgen (neueste zuerst). Ermöglicht das Schreiben eines internen Kommentars.

### Tab: Kommentare

Zeigt nur **interne Kommentare** des Teams.

- Kommentare sind **nur intern** sichtbar — Kunden sehen sie nicht.
- Jeder Kommentar wird mit Autor und Zeitstempel versehen.
- Kommentare können nicht bearbeitet oder gelöscht werden (Revisionssicherheit).

### Tab: Verlauf

Zeigt das **Audit-Log** — ein automatisches Protokoll jeder Änderung am Auftrag (read-only):

| Ereignis | Eintrag |
|----------|---------|
| Phasenänderung | Von- und Zu-Phase mit Zeitstempel und Benutzer |
| Datei hochgeladen | Dateiname, Zeitstempel, Benutzer |
| Kommentar hinzugefügt | Zeitstempel und Benutzer |
| Job verknüpft/entfernt | Name des Druckjobs |
| Kundennachricht versendet | Vorschau der Nachricht |

### Tab: Kundenkontakt

Ermöglicht das direkte Anschreiben des Kunden per E-Mail ohne das System zu verlassen:

1. Wechsle zum Tab **Kundenkontakt**.
2. Schreibe deine Nachricht im Textfeld (ein Hinweis zeigt die Ziel-E-Mail-Adresse an).
3. Klicke **An Kunde senden** — die Nachricht wird sofort per E-Mail zugestellt.

Gesendete Nachrichten erscheinen anschließend im Tab **Kundenkontakt** und im Tab **Alle** mit dem Badge *"An Kunde gesendet"*.

Das E-Mail-Template (Betreff und Rahmtext) kann unter [[Einstellungen → E-Mails|settings]] konfiguriert werden (Abschnitt „E-Mail: Kundennachricht").

## Umfrage-Ergebnis

Wenn der Auftrag eine Kundenzufriedenheits-Umfrage enthält, wird das Ergebnis hier angezeigt (Bewertung und optionaler Kommentar des Kunden).

## Roadmap-Strip mit Sprints

Aufträge, die nicht zu einem [[Projekte|Projekt]] gehören, zeigen oben in der Seitenleiste eine **Roadmap-Karte** mit einem horizontalen Zeitstrahl. Sie ersetzt die frühere flache Meilenstein-Liste und gliedert Termine nach **Sprints**.

### Sprint-Switcher

- Jeder Auftrag kann mehrere parallele/nachgelagerte Sprints haben (z. B. „Vorserie", „Hauptserie", „Nachserie").
- Über die Pillen oben wählst du den aktiven Sprint. Der Mini-Donut links neben dem Sprint-Namen zeigt den Fortschritt der enthaltenen Aufgaben in Prozent.
- Klicke auf den `+`-Button am Ende der Sprint-Liste, um einen neuen Sprint anzulegen. Direkt im Anschluss öffnet sich das Add-Milestone-Popover.
- Das Kebab-Menü neben jedem Sprint bietet **Umbenennen** und **Sprint löschen**. Beim Löschen erscheint ein Bestätigungs-Popover mit Anzahl betroffener Meilensteine und Aufgaben.

### Meilenstein-Stops

Im aktiven Sprint zeigt der Zeitstrahl pro Meilenstein einen runden Stop:
- **Grüner Haken** — abgeschlossen
- **Brand-Flagge** — aktueller Meilenstein
- **Roter Warn-Stop** — überfällig (Datum in der Vergangenheit, noch nicht erledigt)
- **Pizza-Slice-Ring** — pro Aufgabe ein Tortenstück, gefüllt sobald die Aufgabe abgehakt ist

Klick auf den Stop öffnet ein Popover mit Aufgabenliste:
- Aufgaben einzeln per Checkbox abhaken (animierter Slice-Flash am Ring)
- Wenn alle Aufgaben erledigt sind, feiert der Stop mit kurzem Pop + Sparkles
- Name, Datum und einzelne Aufgaben sind per Klick inline editierbar (Enter speichert, Esc verwirft)
- Aufgabe löschen: × am Hover-Rand der Aufgaben-Zeile
- Meilenstein löschen: dezenter Link am Panel-Ende → Inline-Confirm

### Neuen Meilenstein anlegen

1. Klicke auf das `+`-Symbol oben rechts in der Roadmap-Karte.
2. Trage **Bezeichnung** und **Termin** (beides Pflicht) ein.
3. Speichern legt den Meilenstein im aktuellen Sprint an und öffnet direkt das Popover, damit du Aufgaben hinzufügen kannst.

## Verknüpfte Druckjobs

Im Seitenbereich siehst du, welchen [[Druckjobs]] dieser Auftrag aktuell zugeordnet ist. Du kannst die Zuweisung direkt hier ändern oder den verlinkten Job öffnen.

## Auftrag archivieren

1. Klicke oben rechts auf das **Aktions-Menü** (drei Punkte).
2. Wähle **Archivieren**.
3. Der Auftrag verschwindet aus der aktiven [[Aufträge|Auftragsliste]].
4. Archivierte Aufträge sind über den Filter **Archiviert** in der Liste wieder auffindbar.

Archivierte Aufträge können reaktiviert werden, indem du die Archivierung aufhebst (gleicher Menüpunkt).
