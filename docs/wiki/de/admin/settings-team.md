---
title: "Einstellungen → Team"
description: "Teammitglieder einladen, Rollen verwalten und Mitglieder entfernen"
route: "/admin/settings?tab=team"
icon: "Users"
group: "Wissen & Verwaltung"
order: 9.3
---

# Teamverwaltung

![Einstellungen Team](/wiki-screenshots/settings-team.png)

Unter dem Tab **Team** verwaltest du alle Benutzerkonten des Administrations-Backends. Kunden-Accounts werden separat unter [[Kunden]] verwaltet.

## Rollen im System

| Rolle | Berechtigungen |
|-------|---------------|
| **ADMIN** | Vollzugriff: alle Bereiche inkl. Einstellungen, Team, Kunden, Phasen und Maschinen |
| **TEAM_MEMBER** | Aufträge, Druckjobs, Planung, Inventar, Wissensdatenbank — keine Einstellungen |

Es muss immer mindestens ein Admin-Account im System vorhanden sein.

## Teammitglied einladen

1. Klicke auf **Mitglied einladen**.
2. Gib Name und E-Mail-Adresse ein.
3. Wähle die Rolle (**Admin** oder **Team-Mitglied**).
4. Klicke **Einladen senden**.

Das eingeladene Mitglied erhält eine E-Mail mit einem Link, über den es ein Passwort setzen und sich einloggen kann. Der Link ist 24 Stunden gültig.

> Wenn die Einladungs-E-Mail nicht angekommen ist, prüfe den Spam-Ordner. Alternativ kannst du dem Mitglied den Passwort-Reset-Link unter `/auth/reset-password` mitteilen.

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
