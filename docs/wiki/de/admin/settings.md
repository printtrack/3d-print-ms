---
title: "Einstellungen"
description: "Firmenname, E-Mail-Vorlagen, Phasen, Team und Maschinen verwalten (nur Admin)"
route: "/admin/settings"
icon: "SlidersHorizontal"
group: "Wissen & Verwaltung"
order: 9
---

# Einstellungen

Der Einstellungsbereich ist **ausschließlich für Admins**. Hier konfigurierst du das gesamte System.

## Firmen-Einstellungen

- **Firmenname** — wird in der Sidebar und in E-Mails angezeigt
- **Kontakt-E-Mail** — Absender-Adresse für ausgehende E-Mails

## E-Mail-Vorlagen

Für jede Phasenänderung kann eine automatische E-Mail an den Kunden gesendet werden. Konfiguriere für jede Vorlage:

- **Betreff** (Deutsch und Englisch)
- **Nachricht** (Deutsch und Englisch)
- Platzhalter: `{customerName}`, `{orderNumber}`, `{phase}`, `{trackingLink}`

## Phasen

Verwalte die Phasen, durch die [[Aufträge]] laufen:

- **Reihenfolge** — per Drag & Drop anpassen
- **Name** — in Deutsch und Englisch
- **Farbe** — wird auf dem [[Dashboard]] als Spaltenfarbe gezeigt

## Team

Lade Team-Mitglieder ein und verwalte deren Rollen:

| Rolle | Berechtigungen |
|-------|---------------|
| **ADMIN** | Vollzugriff inkl. Einstellungen, Team, Kunden |
| **MEMBER** | Aufträge, Jobs, Planung, Inventar, Wissensdatenbank |

Neue Mitglieder erhalten eine Einladungs-E-Mail mit einem Link zum Passwort-Setzen.

## Maschinen

Lege 3D-Drucker an, die bei [[Druckjobs]] ausgewählt werden können:

- **Name** und **Modell**
- **Aktiv/Inaktiv** — inaktive Maschinen tauchen bei neuen Jobs nicht mehr auf
