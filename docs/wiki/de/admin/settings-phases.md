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

### Reihenfolge ändern

Ziehe eine Phase per **Drag & Drop** an die gewünschte Position. Die neue Reihenfolge wird sofort gespeichert und im [[Dashboard]] übernommen.

### Phase bearbeiten

Klicke auf das **Stift-Symbol** neben einer Phase, bearbeite die Felder und klicke **Speichern**.

### Phase löschen

Klicke auf das **Papierkorb-Symbol** neben der Phase. Eine Phase kann nur gelöscht werden, wenn ihr **keine Aufträge** mehr zugewiesen sind. Bewege die Aufträge zuerst in eine andere Phase.

> Die Standard-Phase (erster Eingang neuer Aufträge) kann nicht gelöscht werden, solange sie als Standard markiert ist. Setze zuerst eine andere Phase als Standard.

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
