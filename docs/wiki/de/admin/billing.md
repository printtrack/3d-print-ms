---
title: "Angebote & Rechnungen"
description: "Abrechnung eines Auftrags: Angebot erstellen und versenden, Freigabe, Rechnung ausstellen, Zahlungen, Mahnungen und Storno"
icon: "Receipt"
group: "Aufträge & Produktion"
order: 2.4
---

# Angebote & Rechnungen

Die komplette Abrechnung eines Auftrags läuft direkt in der [[Auftrags-Detailansicht|orders-detail]] ab — im Seitenbereich rechts. Sie folgt einem festen Ablauf:

**Angebot** → Kunde gibt frei → **Rechnung** → **Zahlung** → ggf. **Mahnung** oder **Storno**

![Abrechnungs-Bereich in der Auftrags-Detailansicht](/wiki-screenshots/billing.png)

> Die Grundeinstellungen (Firmendaten auf den Belegen, Steuer/Kleinunternehmer, Bankverbindung, Nummernkreise, Zahlungsziel und Mahn-Erinnerungen) werden einmalig unter [[Einstellungen → Abrechnung & Belege|settings-billing]] hinterlegt.

---

## 1. Angebot (Quote)

Das Angebot ist die erste Stufe. Es hält die voraussichtlichen Kosten fest und wird dem Kunden zur Freigabe geschickt.

### Angebot erstellen

1. In der Angebots-Karte auf **Angebot erstellen** klicken — es entsteht ein leerer **Entwurf** (Status `Entwurf`).
2. Der Bearbeitungs-Dialog öffnet sich automatisch.

![Angebots-Editor mit Posten](/wiki-screenshots/billing-quote.png)

### Posten erfassen

Jede Zeile im Angebot ist ein **Posten** mit diesen Feldern:

| Feld | Beschreibung |
|------|--------------|
| **Beschreibung** | Bezeichnung des Postens (Pflicht zum Versenden) |
| **Menge** | Anzahl (Dezimalwerte erlaubt, z. B. Materialgewicht) |
| **Einzelpreis** | Netto-Preis pro Einheit in Euro |
| **Steuer** | Steuersatz in Prozent (Standard 19 %) |
| **Kategorie** | Filament, Hardware, Nachbearbeitung, Design, Versand, Rabatt, Sonstiges |
| **Quelle** | Schätzung, Festpreis oder Ist-Wert (siehe unten) |

**Posten-Quelle** steuert, wie verbindlich ein Preis ist:

- **Schätzung** — ein vorläufiger Wert, der sich bis zur Rechnung noch ändern darf. Schätzpositionen ohne Preis bekommen ein ⚠️-Symbol als Erinnerung.
- **Festpreis** — ein fest zugesagter Betrag.
- **Ist-Wert** — der tatsächlich angefallene Wert (z. B. nach dem Druck gemessenes Filament).

### Posten aus Teilen übernehmen

Über **Aus Teilen** (Zauberstab-Symbol) übernimmt der Editor automatisch Schätzpositionen aus den tatsächlichen [[Teile|orders-detail]]-Iterationen des Auftrags. So musst du Filament- und Materialposten nicht manuell tippen. Der Aufruf ist beliebig oft möglich; bereits vorhandene Posten werden nicht doppelt angelegt.

### Speichern, Senden, Löschen

Im Entwurfs-Modus stehen drei Aktionen zur Verfügung:

- **Speichern** — Änderungen sichern, Angebot bleibt Entwurf.
- **Senden** — speichert und versendet das Angebot per E-Mail an den Kunden (mit PDF-Anhang). Status wechselt auf `Gesendet`. Es wird automatisch eine **Freigabe-Anfrage** (`VerificationRequest`) erzeugt. Senden ist nur möglich, wenn mindestens ein Posten mit Beschreibung existiert.
- **Löschen** — verwirft den Entwurf vollständig (nur im Entwurfs-Status möglich).

Optional kannst du ein **Gültig-bis-Datum** und **Notizen** (erscheinen auf dem PDF) hinterlegen.

### Freigabe durch den Kunden

Nach dem Versand öffnet der Kunde das Angebot über seinen Tracking-Link bzw. im [[Kundenportal & Verifizierung|portal]] und kann es **freigeben** oder **ablehnen**:

- **Freigegeben** (`APPROVED`) — Status wird grün, die Rechnung kann erstellt werden.
- **Abgelehnt** (`REJECTED`) — der Ablehnungsgrund des Kunden wird rot in der Angebots-Karte angezeigt.

### Angebots-Status im Überblick

| Status | Bedeutung |
|--------|-----------|
| `Entwurf` | Wird noch bearbeitet, Kunde sieht nichts |
| `Gesendet` | An Kunde verschickt, wartet auf Freigabe |
| `Freigegeben` | Kunde hat zugestimmt → Rechnung möglich |
| `Abgelehnt` | Kunde hat abgelehnt (mit Begründung) |
| `Abgelaufen` | Gültig-bis-Datum überschritten |
| `Ersetzt` | Durch eine neuere Version abgelöst |

### Neue Version

Solange ein Angebot nicht freigegeben ist, kannst du über **Neue Version** eine überarbeitete Fassung erstellen. Sie wird als Kopie des bisherigen Angebots angelegt; die alte Version erhält den Status `Ersetzt`. Die Versionsnummer (`v2`, `v3`, …) erscheint im Status-Badge.

---

## 2. Rechnung (Invoice)

Eine Rechnung kann nur aus einem **freigegebenen Angebot** entstehen. Ist noch kein Angebot freigegeben, weist die Rechnungs-Karte darauf hin.

### Rechnungs-Entwurf erstellen

In der Rechnungs-Karte auf **Rechnung erstellen** klicken. Aus dem freigegebenen Angebot wird ein Rechnungs-**Entwurf** mit allen Posten übernommen.

### Vor dem Ausstellen prüfen (Diff-Ansicht)

Beim Klick auf **Prüfen & ausstellen** öffnet sich ein **Vergleichs-Dialog**, der Angebot und Rechnung Posten für Posten gegenüberstellt:

- **Schätzpositionen**, deren Wert sich geändert hat, werden gelb markiert (alter Wert durchgestrichen → neuer Wert).
- Eine Gesamtsummen-Zeile zeigt die Differenz (Δ) zwischen Angebot und Rechnung.
- So siehst du vor dem endgültigen Ausstellen, wo die Rechnung von der ursprünglichen Schätzung abweicht.

### Ausstellen

Beim **Ausstellen** passiert Folgendes unwiderruflich:

1. Die Rechnung erhält eine fortlaufende **Rechnungsnummer** (Nummernkreis aus den [[Einstellungen → Abrechnung & Belege|settings-billing]]).
2. Das **PDF wird gerendert und archiviert** (revisionssicher — spätere Änderungen am Beleg sind nicht mehr möglich).
3. Die Rechnung wird per E-Mail an den Kunden geschickt.
4. Status wechselt von `Entwurf` auf `Ausgestellt`, ein **Fälligkeitsdatum** wird anhand des Zahlungsziels gesetzt.

> Ein Entwurf kann vor dem Ausstellen jederzeit über das Papierkorb-Symbol gelöscht werden.

### Rechnungs-Status im Überblick

| Status | Bedeutung |
|--------|-----------|
| `Entwurf` | Noch nicht ausgestellt, keine Nummer |
| `Ausgestellt` | Verschickt, wartet auf Zahlung |
| `Teilweise bezahlt` | Erste Zahlung erfasst, Restbetrag offen |
| `Bezahlt` | Vollständig beglichen |
| `Überfällig` | Fälligkeitsdatum überschritten, nicht (vollständig) bezahlt |
| `Storniert` | Durch eine Storno-Rechnung aufgehoben |

---

## 3. Zahlungen

Bei ausgestellten Rechnungen (`Ausgestellt`, `Teilweise bezahlt`, `Überfällig`) erfasst du Zahlungseingänge über **Zahlung erfassen**.

### Zahlung erfassen

1. Betrag (vorbelegt mit dem offenen Restbetrag) und Zahldatum eintragen.
2. **Zahlungsart** wählen: SEPA, Bar, Karte, PayPal, Guthaben oder Sonstiges.
3. Optional Referenz (z. B. Verwendungszweck) und interne Notiz.
4. **Erfassen**.

### Teilzahlungen

Du kannst mehrere Teilzahlungen erfassen. Die Rechnungs-Karte zeigt dann einen **Fortschrittsbalken** und den verbleibenden Restbetrag. Sobald die Summe den Rechnungsbetrag erreicht, springt der Status automatisch auf `Bezahlt`.

### Kundenguthaben

Hat der Kunde ein Guthaben (z. B. aus einer Gutschrift), erscheint im Zahlungsdialog eine grüne **Guthaben-Schnellaktion**. Ein Klick übernimmt den passenden Betrag und setzt die Zahlungsart auf `Guthaben`.

### Zahlung entfernen

Eine versehentlich erfasste Zahlung kann (nur als **Admin**) wieder entfernt werden; der Rechnungsstatus wird automatisch neu berechnet.

---

## 4. Mahnungen (automatisch)

Sind Mahn-Erinnerungen in den [[Einstellungen → Abrechnung & Belege|settings-billing]] aktiviert, verschickt das System automatisch gestaffelte Erinnerungen. Jede Stufe wird **pro Rechnung nur einmal** versendet.

| Stufe | Zeitpunkt (Standard) | Inhalt |
|-------|----------------------|--------|
| Vor-Fälligkeit | 3 Tage **vor** Fälligkeit | Freundliche Erinnerung |
| 1. Erinnerung | 7 Tage **nach** Fälligkeit | Zahlungserinnerung (ohne Gebühr) |
| 1. Mahnung | 21 Tage nach Fälligkeit | Mahnung mit optionaler Mahngebühr (Standard 5 €) |
| 2. Mahnung | 42 Tage nach Fälligkeit | Mahnung mit optionaler Mahngebühr (Standard 10 €) |

Der Versand läuft über einen **Sweep**, der bei jedem Laden einer Auftrags-Detailseite und über `POST /api/admin/invoices/auto-transition` ausgelöst wird. Derselbe Sweep setzt überfällige Rechnungen automatisch auf `Überfällig` und schließt vollständig bezahlte Aufträge ab.

---

## 5. Storno

Eine bereits ausgestellte Rechnung kann nicht gelöscht, aber **storniert** werden (Klick auf das ✕-Symbol in der Rechnungs-Karte):

- Es wird eine **Storno-Rechnung** erzeugt — ein negativer Zwilling der Originalrechnung (gleiche Posten, negative Beträge).
- Die Originalrechnung erhält den Status `Storniert` (durchgestrichen dargestellt).
- Beide Belege bleiben aus Gründen der Revisionssicherheit erhalten.

---

## PDFs

- **Angebots-PDF** und **Rechnungs-PDF** öffnest du jederzeit über den **PDF**-Button in der jeweiligen Karte.
- Für das Team sind die PDFs auth-geschützt; der Kunde erreicht seine Belege token-geschützt über den Tracking-Link bzw. das [[Kundenportal & Verifizierung|portal]].
- Das Aussehen (Logo, Firmendaten, Akzentfarbe, Fußzeile) konfigurierst du unter [[Einstellungen → Abrechnung & Belege|settings-billing]].

## Verlauf

Alle Abrechnungs-Ereignisse (Angebot erstellt/gesendet, Rechnung ausgestellt/storniert, Zahlung erfasst/entfernt, Mahnung versendet) erscheinen im Tab **Verlauf** des [[Auftrags-Detailansicht|orders-detail]]-Aktivitätsbereichs.
