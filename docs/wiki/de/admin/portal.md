---
title: "Kundenportal & Verifizierung"
description: "Wie Kunden sich registrieren, verifiziert werden und im Portal Aufträge, Angebote und Rechnungen sehen"
route: "/portal/signin"
icon: "UserRound"
group: "Wissen & Verwaltung"
order: 7.5
---

# Kundenportal & Verifizierung

Neben dem öffentlichen Auftragsformular und der Tracking-Seite gibt es ein **Kundenportal**, in dem registrierte Kunden ihre Aufträge bündeln, Angebote freigeben und Rechnungen abrufen. Diese Seite erklärt das Zusammenspiel aus Admin-Sicht. Die Verwaltung der Kundendatensätze selbst ist unter [[Kunden|customers]] beschrieben.

![Kundenportal Anmeldung](/wiki-screenshots/portal.png)

## Registrierung & Anmeldung

- Kunden registrieren sich selbst unter `/portal/register`.
- Nach erfolgreicher Verifizierung melden sie sich unter `/portal/signin` an.
- Im Portal (`/portal`) sehen sie ihre eigenen Aufträge, reichen über `/portal/orders/new` neue Aufträge ein und verfolgen den Status.

## Verifizierungs-Modi

Wie neu registrierte Kunden freigeschaltet werden, legst du unter [[Einstellungen]] (Bereich **Unternehmen**, Feld *Verifikation neu registrierter Kunden*) fest. Es gibt drei Modi:

| Modus | Verhalten |
|-------|-----------|
| **Keine Verifikation** | Kunden sind sofort bestellberechtigt — kein zusätzlicher Schritt |
| **Manuell durch Admin** | Ein Admin schaltet jeden Kunden manuell unter [[Kunden|customers]] frei |
| **Per E-Mail-Bestätigung** | Der Kunde erhält einen Bestätigungs-Link und verifiziert sich selbst |

Details zum Freischalten, Zurücksetzen und erneuten Versenden der Bestätigung findest du unter [[Kunden|customers]].

> **Zugangscode:** Optional kannst du im selben Bereich einen **Zugangscode für das Auftragsformular** aktivieren. Dann ist das öffentliche Formular nur mit Code erreichbar — nützlich für geschlossene Nutzergruppen.

## Angebote freigeben (Kundensicht)

Schickst du ein [[Angebote & Rechnungen|billing]] ab, sieht der Kunde es im Portal bzw. über seinen Tracking-Link:

- Alle Posten mit Mengen, Einzelpreisen und Summe; Schätzpositionen sind als solche gekennzeichnet (mit Hinweis, dass sich der Endbetrag noch ändern kann).
- Buttons **Freigeben** und **Ablehnen** (bei Ablehnung mit Begründungsfeld).
- Download des Angebots-PDFs.

Die Entscheidung des Kunden setzt den Angebotsstatus im Admin sofort auf `Freigegeben` bzw. `Abgelehnt` und schaltet — bei Freigabe — die Rechnungserstellung frei.

## Rechnungen abrufen (Kundensicht)

Ausgestellte Rechnungen erscheinen ebenfalls im Portal. Der Kunde sieht Betrag, Fälligkeit und Zahlungsstatus und kann das **Rechnungs-PDF** (token-geschützt) herunterladen. Mahnungen und Zahlungserinnerungen werden automatisch per E-Mail zugestellt (siehe [[Angebote & Rechnungen|billing]]).

## Zusammenspiel mit Aufträgen

- Ein Auftrag kann mit einem Kundendatensatz verknüpft sein — so landen mehrere Aufträge gebündelt im Portal des Kunden.
- Die E-Mail-Sprache des Kunden bestimmt, in welcher Sprache automatische Benachrichtigungen, Angebote und Rechnungen verschickt werden.
