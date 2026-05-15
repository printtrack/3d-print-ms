---
title: "Kunden"
description: "Kundendaten verwalten, E-Mail-Verifizierung steuern und Portal-Zugang verstehen (nur Admin)"
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

| Spalte | Inhalt |
|--------|--------|
| **Name** | Vollständiger Name des Kunden |
| **E-Mail** | Registrierte E-Mail-Adresse |
| **Registriert am** | Datum der Registrierung |
| **Verifiziert** | Ob die E-Mail-Adresse bestätigt wurde (Häkchen oder Warnsymbol) |
| **Aktionen** | Bearbeiten, Verifizieren, Löschen |

## Suche

Das Suchfeld oben filtert die Liste nach Name und E-Mail in Echtzeit.

## E-Mail-Verifizierung

Kunden müssen nach der Registrierung ihre E-Mail-Adresse über einen Bestätigungslink verifizieren, bevor sie das Portal nutzen können.

### Manuelle Verifizierung durch Admin

Wenn ein Kunde seinen Bestätigungslink nicht erhalten hat (Spam-Filter, falsche E-Mail, etc.):

1. Klicke auf das **Häkchen-Symbol** neben dem Kunden.
2. Die E-Mail gilt damit als verifiziert — der Kunde kann sich sofort einloggen.

### Verifizierung zurücksetzen

Klicke erneut auf das Häkchen-Symbol, um die Verifizierung zu entfernen. Der Kunde muss sich dann neu verifizieren.

### Neue Verifizierungs-E-Mail durch Kunden

Alternativ kann der Kunde selbst eine neue Bestätigungs-E-Mail anfordern, indem er sich ins Portal einloggt (`/portal/signin`) und dort auf **E-Mail erneut senden** klickt.

## Kunden bearbeiten

1. Klicke auf das **Bearbeiten-Symbol** (Stift) neben dem Kunden.
2. Ändere Name oder E-Mail-Adresse.
3. Klicke **Speichern**.

> Bei einer Änderung der E-Mail-Adresse wird die Verifizierung **nicht zurückgesetzt** — sofern nötig, setze sie manuell zurück.

## Kunden löschen

1. Klicke auf das **Papierkorb-Symbol** neben dem Kunden.
2. Bestätige den Dialog.

Das Kunden-Konto wird dauerhaft gelöscht. Bestehende **Aufträge**, die diesem Kunden zugeordnet sind, bleiben erhalten — nur die Verknüpfung zum Portal-Account wird aufgehoben.

## Kunden-Portal

Kunden registrieren sich selbst unter `/portal/register`. Nach erfolgreicher E-Mail-Verifizierung können sie sich unter `/portal/signin` einloggen und:

- Ihre eigenen Aufträge einsehen und den Status verfolgen
- Neue Aufträge einreichen
- Dateien zu ihren Aufträgen hochladen

Das Portal ist vollständig von der Admin-Oberfläche getrennt — Kunden sehen keine internen Notizen, Kommentare oder Audit-Logs.
