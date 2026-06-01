---
title: "Einstellungen → Phasen"
description: "Auftragsphasen, Teilphasen und Projektphasen anlegen, bearbeiten und sortieren"
route: "/admin/settings?tab=phasen"
icon: "Layers"
group: "Wissen & Verwaltung"
order: 9.2
---

# Phasen verwalten

![Einstellungen Phasen](/wiki-screenshots/settings-phases.png)

Phasen steuern, welche Stationen ein Auftrag, ein Einzelteil oder ein Projekt durchläuft. Die Konfiguration ist in drei Bereiche unterteilt: **Auftragsphasen**, **Teilphasen** und **Projektphasen**.

## Auftragsphasen (Tab: Phasen)

Auftragsphasen bilden die Spalten des [[Dashboard]] und definieren den Workflow für jeden Kundenauftrag.

### Phase anlegen

1. Scrolle ans Ende der Phasenliste und klicke **+ Phase hinzufügen**.
2. Fülle Name (DE und EN), Farbe und optionale Flags aus.
3. Klicke **Speichern**.

### Phasen-Felder

| Feld | Beschreibung |
|------|--------------|
| **Name (DE)** | Deutscher Phasenname (z. B. "In Bearbeitung") |
| **Name (EN)** | Englischer Phasenname (z. B. "In Progress") |
| **Farbe** | Hex-Farbcode oder Farbwähler — wird als Spaltenfarbe im Dashboard gezeigt |
| **Standard** | Diese Phase wird neuen Aufträgen automatisch zugewiesen |
| **Umfrage-Phase** | Kunden erhalten nach Erreichen dieser Phase die Zufriedenheits-Umfrage |
| **Prototyp-Phase** | Markiert Prototypen-Aufträge (optionales Flag) |
| **Archiv-Phase** | Aufträge werden beim Eintritt automatisch archiviert (`archivedAt` wird gesetzt). Bewege einen Auftrag heraus → er wird wieder aktiv. Ideal in Kombination mit Auto-Advance wie `Umfrage ausgefüllt`. |

### Reihenfolge ändern

Ziehe eine Phase per **Drag & Drop** an die gewünschte Position. Die neue Reihenfolge wird sofort gespeichert und im [[Dashboard]] übernommen.

### Phase bearbeiten

Klicke auf das **Stift-Symbol** neben einer Phase, bearbeite die Felder und klicke **Speichern**.

### Phase löschen

Klicke auf das **Papierkorb-Symbol** neben der Phase. Eine Phase kann nur gelöscht werden, wenn ihr **keine Aufträge** mehr zugewiesen sind. Bewege die Aufträge zuerst in eine andere Phase.

> Die Standard-Phase (erster Eingang neuer Aufträge) kann nicht gelöscht werden, solange sie als Standard markiert ist. Setze zuerst eine andere Phase als Standard.

### Phasen-Flow-Diagramm

Über der Phasenliste zeigt ein horizontales **Flow-Diagramm** alle Phasen in der konfigurierten Reihenfolge mit Pfeilen dazwischen. Es visualisiert auf einen Blick, welche Phasen ein Eintritts-Gate haben (🔒 Lock-Icon) und welche bei erfüllten Bedingungen automatisch in die nächste Phase springen (animierter Pfeil + `Auto`-Badge). Ein Klick auf eine Phase im Diagramm öffnet den Editor.

### Gate (Eintritts-Bedingung)

Im Phasen-Editor unter dem Tab **Gate** kannst du Bedingungen definieren, die erfüllt sein müssen, damit ein Auftrag in diese Phase verschoben werden darf. Wenn ein Admin per Drag & Drop versucht, einen Auftrag dorthin zu ziehen, dessen Gate nicht erfüllt ist, erscheint ein **Override-Dialog** mit den unerfüllten Bedingungen und einem Pflichtfeld für die Begründung. Der Override wird im Audit-Log als `GATE_OVERRIDDEN` festgehalten.

**Verfügbare Bedingungen** (es gilt UND-Logik — alle aktivierten Bedingungen müssen erfüllt sein):

| Bedingung | Erfüllt wenn… |
|-----------|---------------|
| Alle Teile sind druckbereit | Jedes Teil des Auftrags ist in einer Teilphase mit Flag `Druckbereit` |
| Alle Teile sind gedruckt | Jedes Teil ist in einer Teilphase mit Flag `Gedruckt` |
| Alle Teile sind als Fehldruck markiert | Jedes Teil ist in einer Teilphase mit Flag `Fehldruck` |
| Alle Druckjobs abgeschlossen | Alle zum Auftrag verknüpften Print-Jobs sind im Status `DONE` oder `CANCELLED` |
| Angebot freigegeben | Es existiert kein Quote (Bedingung gilt nicht), ODER der jüngste Quote hat Status `APPROVED`. Aufträge ohne Angebots-Workflow werden also nicht blockiert. |
| Rechnung bezahlt | Es existiert eine Invoice mit Status `PAID` |
| Alle Freigaben erledigt | Keine offene `VerificationRequest` mehr |
| Umfrage ausgefüllt | Die `SurveyResponse` hat ein `submittedAt`-Datum |
| Mindestens X Tage in dieser Phase | Letzter `PHASE_CHANGED`-Audit-Log liegt mindestens X Tage zurück |

### Auto-Advance (automatischer Übergang)

Im Tab **Auto-Advance** definierst du Bedingungen, bei deren vollständiger Erfüllung der Auftrag automatisch in die nächste Phase rutscht. Der Trigger ist **event-basiert** — Auto-Advance läuft direkt, wenn sich eine relevante Größe ändert (Job abgeschlossen, Zahlung erfasst, Quote freigegeben, Verification resolved, Umfrage eingereicht usw.). Für rein zeitliche Bedingungen (`Mindestens X Tage in dieser Phase`) wird zusätzlich beim Laden der Order-Detail-Seite ein Fallback-Sweep ausgeführt.

Auto-Advance respektiert das Gate der **Zielphase**: ist dort eine Bedingung unerfüllt, wird der automatische Sprung übersprungen — kein Gate kann durch Auto-Advance umgangen werden.

Eine Order-Card im Kanban zeigt:
- **🔒 Lock-Badge**, wenn das Gate zur nächsten Phase aktuell blockiert
- **→ Pulsierender Pfeil**, wenn ihr Auto-Advance gerade erfüllt wäre

---

## Teilphasen (Tab: Teilphasen)

Teilphasen steuern den Fortschritt einzelner Teile innerhalb eines Auftrags (z. B. Design → Überprüfung → Druckbereit → Gedruckt).

### Felder

| Feld | Beschreibung |
|------|--------------|
| **Name** | Name der Teilphase |
| **Farbe** | Farbmarkierung in der Auftrags-Detailansicht |
| **Standard** | Neue Teile starten in dieser Phase |
| **Druckbereit** | Teile in dieser Phase werden vom Druckjob-Planner berücksichtigt |
| **Überprüfung** | Markiert die Qualitätskontrolle-Phase |
| **Gedruckt** | Teile, die den Druck abgeschlossen haben |
| **Fehldruck** | Markiert fehlgeschlagene Drucke |

### Einfluss auf den Druckjob-Planner

Der automatische Planner sucht gezielt nach Teilen, deren Phase das Flag **Druckbereit** hat. Setze dieses Flag korrekt, damit der Planner nur fertig vorbereitete Teile einplant.

---

## Projektphasen (Tab: Projektphasen)

Projektphasen steuern den Gesamtstatus eines [[Projekte|Projekts]] (z. B. Planung → Aktiv → Abgeschlossen).

Die Konfiguration funktioniert analog zu Auftragsphasen (Name, Farbe, Standard-Flag, Drag & Drop).
