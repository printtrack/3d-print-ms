---
title: "Kunden"
description: "Kundendaten verwalten, E-Mail-Verifizierung steuern (nur Admin)"
route: "/admin/customers"
icon: "Users2"
group: "Wissen & Verwaltung"
order: 8
---

# Kunden

Der Kunden-Bereich ist **ausschließlich für Admins** sichtbar. Hier verwaltest du Kunden, die sich über das Kunden-Portal registriert haben.

![Kunden Übersicht](/wiki-screenshots/customers.png)

## Kundenliste

Die Liste zeigt alle registrierten Kunden mit:

- **Name und E-Mail**
- **Registrierungsdatum**
- **Verifizierungsstatus** — ob die E-Mail-Adresse bestätigt wurde

## E-Mail-Verifizierung

Wenn ein Kunde seine Bestätigungs-E-Mail nicht erhalten hat, kannst du:

1. **Verifizierung manuell setzen** — Klicke auf das Häkchen-Symbol neben dem Kunden. Die E-Mail gilt damit als verifiziert, ohne dass der Kunde selbst agiert.
2. **Verifizierung zurücksetzen** — Klicke erneut, um die Verifizierung zu entfernen.

Der Kunde kann außerdem selbst eine neue Bestätigungs-E-Mail anfordern, indem er sich ins Portal einloggt.

## Kunden bearbeiten

Klicke auf einen Kunden, um Name und E-Mail zu ändern.

## Kunden löschen

Über das Menü kannst du einen Kunden-Account permanent löschen. Bestehende [[Aufträge]] des Kunden bleiben erhalten.

## Zusammenhang mit dem Portal

Kunden registrieren sich unter `/portal/register`. Nach der Verifizierung können sie sich unter `/portal/signin` einloggen und ihre eigenen [[Aufträge]] einsehen.
