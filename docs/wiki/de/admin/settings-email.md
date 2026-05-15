---
title: "Einstellungen → E-Mail-Vorlagen"
description: "Automatische Kunden-Benachrichtigungen pro Phase konfigurieren"
route: "/admin/settings?tab=emails"
icon: "Mail"
group: "Wissen & Verwaltung"
order: 9.1
---

# E-Mail-Vorlagen

![Einstellungen E-Mail-Vorlagen](/wiki-screenshots/settings-email.png)

Für jede Auftragsphase kann eine automatische E-Mail an den Kunden gesendet werden. Die E-Mail wird versendet, sobald ein Auftrag in diese Phase wechselt.

## Vorlage bearbeiten

1. Wähle im Tab **E-Mails** die gewünschte Phase aus der Liste.
2. Aktiviere die Vorlage mit dem **Aktivieren**-Schalter.
3. Fülle Betreff und Nachrichtentext in beiden Sprachen aus.
4. Klicke **Speichern**.

> Wenn keine Vorlage für eine Phase aktiviert ist, wird beim Phasenwechsel keine E-Mail verschickt.

## Felder

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| **Aktiv** | — | Schalter: E-Mail für diese Phase ein- oder ausschalten |
| **Betreff (DE)** | ja* | Betreff der deutschen E-Mail |
| **Nachricht (DE)** | ja* | Text der deutschen E-Mail (Markdown unterstützt) |
| **Betreff (EN)** | ja* | Betreff der englischen E-Mail |
| **Nachricht (EN)** | ja* | Text der englischen E-Mail (Markdown unterstützt) |

*Pflichtfeld, wenn die Vorlage aktiviert ist.

## Platzhalter

Du kannst dynamische Inhalte über Platzhalter einfügen:

| Platzhalter | Ausgabe |
|-------------|---------|
| `{customerName}` | Vollständiger Name des Kunden |
| `{orderNumber}` | Eindeutige Auftragsnummer (Kurzcode) |
| `{phase}` | Name der neuen Phase |
| `{trackingLink}` | Link zur öffentlichen Tracking-Seite des Kunden |

**Beispiel:**

```
Hallo {customerName},

dein Auftrag {orderNumber} befindet sich jetzt in der Phase "{phase}".

Den aktuellen Status kannst du hier einsehen: {trackingLink}

Viele Grüße
Dein 3D-Druck-Team
```

## Sprache der Kunden-E-Mail

Das System erkennt automatisch die bevorzugte Sprache des Kunden (gespeichert bei der Registrierung im Portal) und sendet die E-Mail in der entsprechenden Sprache. Ist keine Sprache gesetzt, wird Deutsch verwendet.

## Umfrage-Tab

Im Tab **Umfrage** konfigurierst du die Kunden-Zufriedenheitsumfrage:

- **Aktivieren** — schaltet die Umfrage ein
- **Phase** — in welcher Phase die Umfrage-E-Mail verschickt wird (empfohlen: Abholbereit oder Abgeschlossen)
- **Betreff und Text** der Umfrage-E-Mail in beiden Sprachen
