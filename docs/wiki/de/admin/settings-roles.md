---
title: "Einstellungen → Rollen & Rechte"
description: "Eigene Rollen anlegen, Berechtigungen vergeben und die Zuweisungs-Sperre einrichten"
route: "/admin/settings?tab=rollen"
icon: "ShieldCheck"
group: "Wissen & Verwaltung"
order: 9.25
---

# Rollen & Rechte

![Rollen und Rechte](/wiki-screenshots/settings-roles.png)

Unter **Einstellungen → Rollen & Rechte** legst du eigene Rollen an — etwa „Schüler" oder „Betreuer" — und bestimmst per Häkchen, was ihre Mitglieder dürfen. Die Zuordnung zu einer Person passiert auf der Seite [[Team]].

## Die zwei Ebenen

Jedes Konto hat **zwei** voneinander unabhängige Einstellungen:

| Feld | Bedeutung |
|------|-----------|
| **Zugriffsebene** | `Admin` oder `Team-Mitglied`. Admins haben immer vollen Zugriff. |
| **Rolle & Rechte** | Nur für Team-Mitglieder: welche der Berechtigungen unten gelten. |

**Admins umgehen jede Prüfung.** Ihnen lässt sich deshalb bewusst keine Rolle zuweisen — sie würde eine Grenze vortäuschen, die es nicht gibt. Das schützt zugleich davor, sich selbst auszusperren: eine falsch konfigurierte Rolle kann einen Admin nie aussperren.

## Rolle anlegen

1. Klicke auf **Rolle anlegen**.
2. Vergib einen Namen (z. B. „Schüler") und optional eine Beschreibung.
3. Entscheide über die **Zuweisungs-Sperre** (siehe unten).
4. Hake die Berechtigungen ab. Löschrechte sind rot markiert und standardmäßig aus.
5. **Speichern**.

Rechte zu abgeschalteten Modulen blendet der Editor aus — hast du z. B. Angebote unter [[Einstellungen → Module]] deaktiviert, taucht die Gruppe „Abrechnung" gar nicht erst auf.

Die Rolle **Team-Mitglied** ist die Standardrolle: sie greift für jedes Mitglied ohne eigene Rolle, lässt sich nicht löschen oder umbenennen — ihre Rechte darfst du aber ändern.

Eine Rolle, der noch Mitglieder zugeordnet sind, lässt sich **nicht** löschen. Weise diesen Personen zuerst eine andere Rolle zu. Sonst würden sie stillschweigend auf die Standardrolle rutschen und plötzlich mehr dürfen als vorgesehen.

## Die Zuweisungs-Sperre

Das ist die restriktive Option für Situationen, in denen niemand fremde Arbeit anfassen soll — etwa im Schulbetrieb.

> **Nur zugewiesene Aufträge bearbeiten:** Mitglieder sehen weiterhin **alles**, können aber nur Aufträge bearbeiten, denen sie zugewiesen sind.

Lesen bleibt also für alle offen: das Kanban-Board, die Auftragsliste und jede Detailseite bleiben sichtbar. Auf fremden Aufträgen erscheint stattdessen ein Hinweis **„Schreibgeschützt — du bist diesem Auftrag nicht zugewiesen"**, und Phase, Auftragstyp, Deadline, Zuweisung und Archivieren sind gesperrt.

### Wann gilt ein Auftrag als „meiner"?

Sobald du auf einer dieser drei Ebenen zugewiesen bist:

- direkt am **Auftrag** (Bearbeiter-Stack in der Kopfzeile)
- an einem **Teil** des Auftrags
- an einem **Meilenstein-Task** des Auftrags

Das ist genau dieselbe Regel wie der Personen-Filter in der Auftragsliste: **was du dort als „meins" gefiltert siehst, darfst du auch bearbeiten.**

### Wo die Sperre nicht greift

Wissensdatenbank und Inventar kennen keine Zuweisungen. Dort zählt allein das Häkchen. Damit ein Schüler keine Wiki-Einträge löscht, nimm ihm also **Wissenseinträge löschen** weg — die Sperre hilft dort nicht.

Bei **Druckaufträgen** gilt eine strengere Regel: ein Sammel-Job kann Teile mehrerer Aufträge enthalten. Ein eingeschränktes Mitglied darf ihn nur bearbeiten, wenn es Zugriff auf **alle** beteiligten Aufträge hat — sonst könnte es über den gemeinsamen Job die Teile anderer verändern. Eine ausdrückliche Zuweisung am Job selbst gilt als bewusste Ausnahme.

Das **Sortieren** von Karten innerhalb einer Kanban-Spalte ist erlaubt, auch für fremde Karten: dabei ändert sich nur die Reihenfolge, nie ein Inhalt.

## Sperre je Mitglied übersteuern

Die Sperre der Rolle ist nur der Standard. Auf der Seite [[Team]] kannst du sie pro Person übersteuern:

| Einstellung | Wirkung |
|-------------|---------|
| **Von Rolle übernehmen** | Standard — es gilt, was an der Rolle eingestellt ist. |
| **Eingeschränkt** | Diese Person ist gesperrt, egal was die Rolle sagt. |
| **Nicht eingeschränkt** | Ausnahme: diese Person darf alles bearbeiten, obwohl die Rolle sperrt. |

So kannst du z. B. der Rolle „Schüler" die Sperre geben und einer einzelnen erfahrenen Person die Ausnahme erteilen — ohne sie gleich zum Admin zu machen.

## Berechtigungen im Überblick

| Gruppe | Rechte |
|--------|--------|
| **Aufträge** | Anlegen, Bearbeiten, Zuweisungen ändern, Archivieren, Löschen |
| **Abrechnung** | Angebote verwalten, Rechnungen verwalten, Zahlungen erfassen |
| **Druckaufträge** | Planen, Verifizieren, Löschen |
| **Projekte** | Anlegen, Bearbeiten, Löschen |
| **Wissensdatenbank** | Anlegen, Bearbeiten, Löschen |
| **Inventar** | Bearbeiten, Löschen |

Einige Bereiche bleiben grundsätzlich Admins vorbehalten und tauchen deshalb nicht als Häkchen auf: Kunden, Maschinen, Einstellungen, das Löschen erfasster Zahlungen — und die Rollenverwaltung selbst. Letzteres mit Absicht: wer Rollen bearbeiten dürfte, könnte sich jedes andere Recht selbst erteilen.

## Änderungen wirken sofort

Nimmst du einer Rolle ein Recht, greift das beim **nächsten Klick** der betroffenen Person — ohne dass sie sich neu anmelden muss.
