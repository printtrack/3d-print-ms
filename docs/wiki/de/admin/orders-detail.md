---
title: "Auftrags-Detailansicht"
description: "Phase ändern, Teile verwalten, Dateien, Kommentare und Audit-Log"
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

## Kommentare

Im Kommentarfeld am unteren Ende kannst du interne Notizen für das Team hinterlassen.

- Kommentare sind **nur intern** sichtbar — Kunden sehen diese nicht.
- Jeder Kommentar wird mit Autor und Zeitstempel versehen.
- Kommentare können nicht bearbeitet oder gelöscht werden (Revisionssicherheit).

## Umfrage-Ergebnis

Wenn der Auftrag eine Kundenzufriedenheits-Umfrage enthält, wird das Ergebnis hier angezeigt (Bewertung und optionaler Kommentar des Kunden).

## Audit-Log

Das Audit-Log am unteren Ende protokolliert automatisch **jede Änderung** am Auftrag:

| Ereignis | Eintrag |
|----------|---------|
| Phasenänderung | Von- und Zu-Phase mit Zeitstempel und Benutzer |
| Datei hochgeladen | Dateiname, Zeitstempel, Benutzer |
| Kommentar hinzugefügt | Zeitstempel und Benutzer |
| Job verknüpft/entfernt | Name des Druckjobs |

Das Log ist nicht editierbar.

## Verknüpfte Druckjobs

Im Seitenbereich siehst du, welchen [[Druckjobs]] dieser Auftrag aktuell zugeordnet ist. Du kannst die Zuweisung direkt hier ändern oder den verlinkten Job öffnen.

## Auftrag archivieren

1. Klicke oben rechts auf das **Aktions-Menü** (drei Punkte).
2. Wähle **Archivieren**.
3. Der Auftrag verschwindet aus der aktiven [[Aufträge|Auftragsliste]].
4. Archivierte Aufträge sind über den Filter **Archiviert** in der Liste wieder auffindbar.

Archivierte Aufträge können reaktiviert werden, indem du die Archivierung aufhebst (gleicher Menüpunkt).
