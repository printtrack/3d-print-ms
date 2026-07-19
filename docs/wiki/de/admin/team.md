---
title: "Team"
description: "Teammitglieder anlegen, einladen, Rollen zuweisen und entfernen"
route: "/admin/team"
icon: "Users"
group: "Wissen & Verwaltung"
order: 8.5
---

# Teamverwaltung

![Team](/wiki-screenshots/team.png)

Unter **Team** (in der Sidebar unter „Wissen & Verwaltung", neben [[Kunden]]) verwaltest du alle Benutzerkonten des Administrations-Backends. Kunden-Accounts werden separat unter [[Kunden]] verwaltet.

## Zugriffsebene und Rolle

Jedes Konto hat zwei voneinander unabhängige Einstellungen:

| Feld | Bedeutung |
|------|-----------|
| **Zugriffsebene** | `Admin` — Vollzugriff auf alles inkl. Einstellungen, Team, Kunden und Maschinen. `Team-Mitglied` — was die Rolle erlaubt. |
| **Rolle & Rechte** | Nur für Team-Mitglieder: bestimmt die Berechtigungen. Anlegen und bearbeiten unter [[Einstellungen → Rollen & Rechte]]. |
| **Zuweisungs-Sperre** | Übersteuert je Mitglied, ob nur zugewiesene Aufträge bearbeitet werden dürfen. |

Admins bekommen bewusst keine Rolle zugewiesen — sie umgehen ohnehin jede Prüfung.

Der **letzte Administrator** lässt sich weder herabstufen noch löschen; es muss immer mindestens ein Admin-Konto vorhanden sein.

### Zuweisungs-Sperre je Mitglied

| Einstellung | Wirkung |
|-------------|---------|
| **Von Rolle übernehmen** | Standard — es gilt, was an der Rolle eingestellt ist. |
| **Eingeschränkt** | Diese Person darf nur zugewiesene Aufträge bearbeiten. |
| **Nicht eingeschränkt** | Ausnahme trotz gesperrter Rolle. |

Ein Schloss-Symbol in der Mitgliederliste zeigt, für wen die Sperre am Ende greift. Details unter [[Einstellungen → Rollen & Rechte]].

## Neue Mitglieder: anlegen oder einladen

Oben rechts öffnet **Hinzufügen** ein Menü mit zwei Wegen:

### Mitglied anlegen

1. **Hinzufügen → Mitglied anlegen**.
2. Gib Name, E-Mail und ein Startpasswort ein.
3. Wähle die Zugriffsebene (**Admin** oder **Team-Mitglied**) sowie – für Team-Mitglieder – Rolle und Zuweisungs-Sperre.
4. Klicke **Erstellen**.

Das Konto ist sofort nutzbar; du gibst dem Mitglied Passwort und Login-Adresse selbst weiter.

### Per Einladungslink hinzufügen

Statt selbst ein Passwort zu vergeben, kannst du – genau wie bei [[Kunden]] – eine **Einladung** verschicken. Das neue Mitglied setzt dann Name und Passwort selbst.

1. **Hinzufügen → Einladen** öffnet den Einladungs-Dialog.
2. **E-Mail (optional)** — Mit Adresse geht die Einladung direkt per Mail raus und gilt nur für diese Adresse. Ohne Adresse entsteht ein **offener Link** zum Weitergeben (wird direkt in die Zwischenablage kopiert).
3. **Notiz (optional)** — z. B. „Werkstudent", nur zur eigenen Übersicht.
4. **Zugriffsebene, Rolle und Zuweisungs-Sperre** — legst schon jetzt du fest; das eingeladene Mitglied kann daran nichts ändern.
5. Klicke **Einladen**.

Die eingeladene Person öffnet den Link (Seite `/auth/accept-invite`), setzt Name und Passwort und wird zur Anmeldung weitergeleitet. Jede Einladung ist **14 Tage** gültig und **nur einmal** einlösbar.

Ausstehende Einladungen erscheinen **direkt in der Mitgliederliste** – als gedämpfte Karte mit dem Hinweis **Einladung ausstehend** (bzw. **Einladung abgelaufen**), der vorgesehenen Rolle sowie Buttons zum **Link kopieren** und **Zurückziehen**. Sobald jemand die Einladung einlöst, wird aus der Karte ein normales Teammitglied.

> Wenn die Einladungs-E-Mail nicht angekommen ist, prüfe den Spam-Ordner – oder kopiere den offenen Link und gib ihn direkt weiter.

## Rolle eines Mitglieds ändern

1. Klicke auf das **Bearbeiten-Symbol** (Stift) neben dem Mitglied.
2. Ändere die Rolle.
3. Klicke **Speichern**.

> Deine eigene Rolle kannst du nicht ändern, um eine versehentliche Selbst-Degradierung zu verhindern.

## Mitglied entfernen

1. Klicke auf das **Papierkorb-Symbol** neben dem Mitglied.
2. Bestätige den Dialog.

Gelöschte Mitglieder können sich nicht mehr einloggen. Aufträge, Kommentare und Audit-Log-Einträge, die dem Mitglied zugeordnet sind, bleiben erhalten — der Name wird weiterhin angezeigt.

## Eigene Zugangsdaten ändern

Passwort und Name des eigenen Accounts können über das Profil-Menü oben rechts in der Sidebar geändert werden (nicht über den Teambereich).
