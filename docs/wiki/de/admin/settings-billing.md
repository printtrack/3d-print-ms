---
title: "Einstellungen → Abrechnung & Belege"
description: "Abrechnungsregeln (Angebotsfreigabe, Zahlungsziel, Mahnwesen) und Belegvorlagen (Firmendaten, Steuer, Bank, Nummernkreise) konfigurieren"
route: "/admin/settings?tab=abrechnung"
icon: "Scale"
group: "Wissen & Verwaltung"
order: 9.5
---

# Abrechnung & Belege

Die Grundlagen für [[Angebote & Rechnungen|billing]] werden in zwei Bereichen der [[Einstellungen]] hinterlegt: **Abrechnung** (Regeln & Abläufe) und **Belege** (Aussehen & Stammdaten der PDFs). Beide sind **nur für Admins** sichtbar.

![Einstellungen Abrechnung](/wiki-screenshots/settings-billing.png)

---

## Bereich: Abrechnung

Steuert, wie der Abrechnungs-Workflow abläuft.

### Berechnungs-Regeln

| Einstellung | Wirkung |
|-------------|---------|
| **Fehldrucke berechnen** | Legt fest, ob misslungene Drucke (Fehldruck-Teile) dem Kunden in Rechnung gestellt werden |
| **Prototypen berechnen** | Legt fest, ob Prototypen-Iterationen berechnet werden |

### Angebotsfreigabe

| Einstellung | Wirkung |
|-------------|---------|
| **Freigabe erforderlich** | Ist sie aktiv, muss der Kunde ein Angebot erst freigeben, bevor produziert/abgerechnet wird (wirkt mit dem Gate **Angebot freigegeben**, siehe [[Einstellungen → Phasen|settings-phases]]) |
| **Mindestbetrag für Freigabe (€)** | Erst ab diesem Betrag ist eine Freigabe nötig — kleine Aufträge laufen ohne Freigabeschritt |

### Zahlungsziel

- **Zahlungsziel (Tage)** — wie viele Tage nach dem Ausstellen einer Rechnung das Fälligkeitsdatum gesetzt wird.

### Mahnwesen

Aktiviere **Erinnerungen aktivieren**, um den automatischen, gestaffelten Mahnlauf einzuschalten. Die Zeitpunkte und Gebühren sind frei konfigurierbar:

| Einstellung | Standard | Bedeutung |
|-------------|----------|-----------|
| **Vor-Fälligkeit (Tage)** | 3 | So viele Tage **vor** Fälligkeit geht eine freundliche Erinnerung raus |
| **Erinnerung (Tage nach Fälligkeit)** | 7 | Erste Zahlungserinnerung nach Fälligkeit (ohne Gebühr) |
| **1. Mahnung (Tage)** | 21 | Erste Mahnung |
| **2. Mahnung (Tage)** | 42 | Zweite Mahnung |
| **Gebühr 1. Mahnung (€)** | 5,00 | Mahngebühr, die der 1. Mahnung aufgeschlagen wird |
| **Gebühr 2. Mahnung (€)** | 10,00 | Mahngebühr der 2. Mahnung |

> Die zugehörigen E-Mail-Texte (Vor-Fälligkeit, Erinnerung, 1./2. Mahnung) werden in beiden Sprachen unter [[Einstellungen → E-Mail-Vorlagen|settings-email]] gepflegt.

---

## Bereich: Belege

Bestimmt Aussehen und Stammdaten der Angebots- und Rechnungs-PDFs.

### Logo

Lade ein Firmenlogo hoch. Es erscheint im Kopf jedes Belegs.

### Firmendaten

| Feld | Beschreibung |
|------|--------------|
| **Firmenname** | Überschreibt den allgemeinen Unternehmensnamen speziell für Belege |
| **Straße & Hausnummer**, **Adresszusatz** | Anschrift im Belegkopf |
| **PLZ/Ort**, **Land** | Restliche Anschrift |

### Steuer

| Feld | Beschreibung |
|------|--------------|
| **Kleinunternehmer nach §19 UStG** | Ist diese Option aktiv, weisen Rechnungen **keine Umsatzsteuer** aus und tragen den §19-Hinweis |
| **USt-IdNr.** | Umsatzsteuer-Identifikationsnummer |
| **Steuernummer (Fallback)** | Wird genutzt, wenn keine USt-IdNr. vorliegt |
| **Standard-MwSt.-Satz (%)** | Vorbelegung des Steuersatzes neuer Angebotsposten |

### Bankverbindung

**Bankname**, **IBAN** und **BIC** — erscheinen als Zahlungsinformationen auf der Rechnung.

### Gestaltung

| Feld | Beschreibung |
|------|--------------|
| **Akzentfarbe (HEX)** | Akzentfarbe der Belege (mit Live-Vorschau) |
| **Footer-Text (Deutsch / Englisch)** | Fußzeile am Beleg-Ende, je Sprache |

### Nummernkreise

| Feld | Beschreibung |
|------|--------------|
| **Angebots-Präfix** | Vorsilbe der Angebotsnummern (z. B. `AN-`) |
| **Rechnungs-Präfix** | Vorsilbe der Rechnungsnummern (z. B. `RE-`) |

Nummern werden beim Versenden eines Angebots bzw. beim Ausstellen einer Rechnung **fortlaufend** vergeben und sind anschließend nicht mehr änderbar (Revisionssicherheit).

---

Alle Änderungen werden nach Klick auf **Speichern** sofort wirksam. Der eigentliche Abrechnungs-Ablauf ist unter [[Angebote & Rechnungen|billing]] beschrieben.
