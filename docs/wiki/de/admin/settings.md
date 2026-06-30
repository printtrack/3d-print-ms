---
title: "Einstellungen"
description: "Systemkonfiguration: Firmendaten, E-Mail-Vorlagen, Phasen, Team und Maschinen (nur Admin)"
route: "/admin/settings"
icon: "SlidersHorizontal"
group: "Wissen & Verwaltung"
order: 9
---

# Einstellungen

Der Einstellungsbereich ist **ausschließlich für Admins**. Hier konfigurierst du das gesamte System. Die Seite ist in Tabs gegliedert.

![Einstellungen Übersicht](/wiki-screenshots/settings.png)

## Tab-Übersicht

| Tab | Inhalt |
|-----|--------|
| **Unternehmen** | Firmenname, Kontakt-E-Mail, Zugangscode und Kunden-Verifizierung |
| **Abrechnung** | Angebotsfreigabe, Zahlungsziel und Mahnwesen → [[Einstellungen → Abrechnung & Belege|settings-billing]] |
| **Belege** | Aussehen und Stammdaten der Angebots-/Rechnungs-PDFs → [[Einstellungen → Abrechnung & Belege|settings-billing]] |
| **Rechtliches** | Impressum und Datenschutzerklärung |
| **E-Mails** | Automatische Phasen-Benachrichtigungen → [[Einstellungen → E-Mail-Vorlagen|settings-email]] |
| **Umfrage** | Konfiguration der Kundenzufriedenheits-Umfrage |
| **Kundenverlauf** | Welche Ereignisse Kunden im Tracking-Verlauf sehen |
| **Phasen** | Auftragsphasen verwalten → [[Einstellungen → Phasen|settings-phases]] |
| **Teilphasen** | Phasen für Einzelteile verwalten → [[Einstellungen → Phasen|settings-phases]] |
| **Projektphasen** | Phasen für Projekte verwalten → [[Einstellungen → Phasen|settings-phases]] |
| **Projekt-Dateiphasen** | Eigene Phasen für Projektdateien (z. B. Entwurf → In Prüfung → Final) → [[Projekte\|projects]] |
| **Team** | Teammitglieder einladen und Rollen verwalten → [[Einstellungen → Team|settings-team]] |
| **Maschinen** | 3D-Drucker anlegen und konfigurieren → [[Einstellungen → Maschinen|settings-machines]] |

## Firmendaten (Tab: Unternehmen)

- **Firmenname** — erscheint in der Sidebar-Navigation und in ausgehenden E-Mails
- **Kontakt-E-Mail** — Absender-Adresse für alle automatischen E-Mails des Systems
- **Zugangscode für Auftragsformular** — optionaler Code, ohne den das öffentliche Auftragsformular nicht zugänglich ist (für geschlossene Nutzergruppen)
- **Verifikation neu registrierter Kunden** — steuert, wie Portal-Kunden freigeschaltet werden (keine / manuell durch Admin / per E-Mail-Bestätigung) → [[Kundenportal & Verifizierung|portal]]

Änderungen werden sofort nach dem Klick auf **Speichern** wirksam.

## Kundenverlauf (Tab: Kundenverlauf)

Auf der öffentlichen Tracking-Seite sehen Kunden einen **Verlauf** mit den wichtigsten Ereignissen ihres Auftrags — graphisch aufbereitet mit Symbol, Farbe und verständlichem Text (z. B. „Angebot gesendet" statt eines technischen Codes).

Hier steuerst du, **welche** Ereignisse Kunden sehen:

- **Verlauf im Tracking anzeigen** — Hauptschalter. Ist er aus, erscheint die gesamte Verlaufs-Karte nicht.
- **Einzelne Ereignisse** — nach Gruppen geordnet (Status & Fortschritt, Dateien, Freigaben & Designprüfung, Abrechnung, Umfrage) lässt sich jedes Ereignis einzeln ein- oder ausschalten.

Wichtig:

- **Interne Vorgänge werden grundsätzlich nie an Kunden übermittelt** — Team-Zuweisungen, Druckaufträge, interne Kommentare, Teilphasen-Wechsel und Preisänderungen erscheinen nie im Kundenverlauf, unabhängig von den Schaltern. Die Filterung passiert serverseitig, diese Daten erreichen den Browser des Kunden gar nicht.
- **Abrechnungs-Ereignisse** (Angebot gesendet, Rechnung gestellt, Zahlung eingegangen, Rechnung storniert) sind **standardmäßig ausgeschaltet**, da Angebot und Rechnung ohnehin als eigene Karten im Tracking erscheinen. Bei Bedarf einzeln aktivierbar.

## Module (Tab: Module)

Unter **Funktionsumfang → Module** legst du fest, welche Funktionen das System lädt. So passt du das Produkt an deinen Betrieb an — z. B. „nur Angebote, keine Rechnungen" oder ein Betrieb ganz ohne Wissensdatenbank.

- Jedes Modul hat einen eigenen Schalter. **Standard: alle aktiv** — der Funktionsumfang ist also vollständig, bis du etwas abschaltest.
- Deaktivierte Module verschwinden aus der Navigation und sind nicht mehr erreichbar (ruft man die Adresse direkt auf, leitet das System zurück zur Übersicht).
- **Rechnungen** benötigen das Modul **Angebote** — ist „Angebote" aus, sind Rechnungen automatisch deaktiviert und der Schalter ist ausgegraut.
- Schaltbar sind u. a.: Angebote, Rechnungen, Druckjobs, Projekte, Planung, Inventar, Wissensdatenbank, Kundenportal, Sendungsverfolgung, Umfrage und Kundenverlauf.

## Marke (Tab: Marke)

Im Reiter **Marke** individualisierst du das Erscheinungsbild der gesamten Anwendung
(White-Label) — Admin, Landing-Page, Kundenportal und Tracking folgen denselben Vorgaben.

- **Akzentfarbe** — die App-weite Markenfarbe (Standard: Amber). Eingabe als HEX (z. B.
  `#2563eb`) oder beliebige CSS-Farbe; ein Farbwähler steht bereit. Leer = Standard.
- **Eigenes Logo** — wird in der Seitenleiste und auf Belegen angezeigt (geteilt mit dem
  Beleg-Logo). JPG, PNG oder SVG, max. 1 MB.
- **Favicon** — das Symbol im Browser-Tab (PNG, SVG oder ICO).
- Der **Anwendungstitel** (Browser-Tab) entspricht dem Unternehmensnamen aus dem Reiter
  „Unternehmen“.

## Auftragsformular (Tab: Auftragsformular)

Hier kannst du das **Auftragsformular anpassen**, mit dem Kunden auf der Startseite einen
Druckauftrag einreichen — passend zum Intake deines Betriebs.

- **Felder** — Auftragstyp und Liefertermin lassen sich ein-/ausblenden; der Liefertermin kann
  zum Pflichtfeld gemacht werden. Name, E-Mail und Beschreibung sind immer Pflicht.
- **Dateien** — erlaubte Formate (Auswahl aus JPG, PNG, GIF, WEBP, STL, OBJ, 3MF), maximale
  Dateigröße (MB) und maximale Anzahl Dateien (0 = unbegrenzt). Die Grenzen werden auch
  serverseitig erzwungen.
- **Einleitung & Zustimmung** — optionaler Einleitungstext über dem Formular sowie eine
  Pflicht-Zustimmung (Checkbox) vor dem Absenden, jeweils in Deutsch und Englisch.

## Rechtliches (Tab: Rechtliches)

Hinterlege Impressum und Datenschutzerklärung. Diese Texte erscheinen auf den öffentlichen Seiten (`/legal/impressum`, `/legal/datenschutz`).

## Subseiten

- [[Einstellungen → Abrechnung & Belege|settings-billing]] — Abrechnungsregeln, Mahnwesen und Belegvorlagen
- [[Einstellungen → E-Mail-Vorlagen|settings-email]] — automatische Phasen-E-Mails konfigurieren
- [[Einstellungen → Phasen|settings-phases]] — Auftragsphasen, Teilphasen und Projektphasen
- [[Einstellungen → Team|settings-team]] — Teammitglieder verwalten
- [[Einstellungen → Maschinen|settings-machines]] — 3D-Drucker anlegen
