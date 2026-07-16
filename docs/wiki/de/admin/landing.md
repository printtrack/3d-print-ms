---
title: "Landing-Page"
description: "Die öffentliche Startseite direkt auf der Seite bearbeiten: Texte, Symbole, Bilder, Reihenfolge"
route: "/admin/landing"
icon: "LayoutTemplate"
group: "Wissen & Verwaltung"
order: 7.5
---

# Landing-Page-Builder

Die öffentliche Startseite (das, was Besucher unter `/` sehen) besteht aus **Blöcken**. Jeder Block ist ein Abschnitt der Seite.

**Du bearbeitest sie direkt auf der Seite selbst.** Es gibt kein Formular daneben: Du siehst deine Startseite, klickst hinein und änderst, was du siehst — Texte, Symbole, Farbtöne, Bilder, die Reihenfolge. Was du tust, ist sofort das Ergebnis.

![Landing-Page-Builder](/wiki-screenshots/landing.png)

## Die Seite zum ersten Mal anpassen

Solange du nichts geändert hast, zeigt die Startseite die mitgelieferten Standardinhalte. Oben steht dann der Hinweis *„Diese Seite nutzt noch die Standardinhalte"*, und noch lässt sich nichts anklicken.

Klicke **Seite anpassen**. Damit werden die Standardinhalte als bearbeitbare Blöcke angelegt — die Seite sieht danach zunächst genau gleich aus, gehört jetzt aber dir. Diesen Schritt machst du nur einmal.

Änderungen werden **automatisch gespeichert**, etwa eine Sekunde nachdem du aufhörst. Es gibt keinen Speichern-Button — aber: gespeichert heißt noch nicht öffentlich (siehe Entwurf & Veröffentlichen).

## Entwurf und Veröffentlichen

Alles, was du bearbeitest, ist ein **Entwurf**. Besucher sehen ihn nicht — sie sehen die zuletzt **veröffentlichte** Fassung. So kannst du in Ruhe umbauen, ohne dass halbfertige Zwischenstände öffentlich werden.

Oben rechts siehst du den Status:

- **Veröffentlicht** — der Entwurf und die öffentliche Seite sind gleich.
- **Entwurf – nicht veröffentlicht** — du hast Änderungen, die noch niemand außer dir sieht.

Zwei Knöpfe:

- **Veröffentlichen** — macht deinen Entwurf zur öffentlichen Seite. Erst jetzt sehen Besucher die Änderungen.
- **Verwerfen** — setzt den Entwurf auf die zuletzt veröffentlichte Fassung zurück. Alles seit der letzten Veröffentlichung ist damit weg (mit Rückfrage).

Solange du noch nie veröffentlicht hast, zeigt die öffentliche Seite weiterhin die Standardinhalte — auch nachdem du „Seite anpassen" geklickt und schon etwas geändert hast. Nichts wird öffentlich, bis du auf **Veröffentlichen** klickst.

## Texte ändern

Fahre über einen Text: Er bekommt einen gestrichelten Rahmen. Klick hinein und schreib los — genau dort, wo der Text später steht.

Leere Felder bleiben im Editor als „…" sichtbar, damit du sie wieder füllen kannst. Auf der echten Seite verschwinden sie.

## Symbole und Farbtöne

Klick auf ein Symbol in den *Vorteile*-Kacheln. Es öffnet sich eine Auswahl mit zwölf Symbolen und sechs Farbtönen.

Die Farbtöne sind **keine freie Farbwahl, sondern Abstufungen deiner Markenfarbe** aus Einstellungen → Marke. Das ist Absicht: Änderst du dort später deine Farbe, ziehen alle Symbole automatisch mit. Bei frei gewählten Farben würden sie in der Farbe von vorgestern stehen bleiben, und die Seite driftete mit jedem Markenwechsel weiter auseinander.

## Bilder

Klick auf ein Bild (oder auf den gestrichelten Platzhalter, wo noch keins ist). Du kannst es ersetzen, entfernen und die **Bildbeschreibung** eintragen, die Screenreadern vorgelesen wird — sie steht nirgends sichtbar auf der Seite und hat deshalb nur hier Platz.

Erlaubt sind JPG, PNG, WebP, GIF und SVG bis 5 MB. Der Server prüft die Datei: Was nur *heißt* wie ein Bild, wird abgelehnt. Es lassen sich nur eigene Uploads verwenden, keine Links auf fremde Websites — die würde das Sicherheits-Regelwerk der Seite ohnehin blockieren, und sie wären eines Tages tot.

## Fließtext mit Formatierung

Bei den Blöcken **Text** und **Text mit Bild** öffnet ein Klick auf den Fließtext den Markdown-Quelltext:

- `**fett**` und `*kursiv*`
- `# Überschrift`, `## Kleinere Überschrift`
- `- Punkt` für Aufzählungen
- `[Linktext](https://example.com)` für Links

Warum nicht direkt tippen wie beim übrigen Text? Weil direktes Tippen in formatierten Text jede Formatierung platt machen würde — fett, Listen und Links wären nach der ersten Änderung weg.

## Buttons

Der Button-Text lässt sich direkt anklicken und ändern. **Wohin** der Button führt, ist nichts Sichtbares — dafür sitzt ein kleines Ketten-Symbol daneben:

- `#order-form` — springt zum Auftragsformular auf derselben Seite
- `/portal/signin` — zum Kundenportal
- `https://…` — zu einer fremden Seite

## Die Block-Werkzeugleiste

Fahre über einen Block: Oben rechts erscheint eine Leiste, die mitscrollt, solange der Block zu sehen ist. Darin:

| Symbol | Wozu? |
|--------|-------|
| ↑ ↓ | Block nach oben oder unten schieben |
| Palette | Hintergrund: Weiß, Grau oder Dunkel. Die Textfarben passen sich automatisch an |
| Auge | Block ausblenden. Er verschwindet von der öffentlichen Seite, bleibt aber im Editor — praktisch, um einen Abschnitt vorzubereiten oder vorübergehend zu verstecken |
| Plus | Einen neuen Block **direkt darunter** einfügen |
| Papierkorb | Block löschen (mit Rückfrage) |
| Schloss | Statt Papierkorb beim Auftragsformular — siehe unten |

Am Ende der Seite sitzt außerdem **Block hinzufügen**, um einen Block anzuhängen.

## Einträge in Listen

Vorteile, Ablauf-Schritte, Galerie-Bilder und Fragen sind Listen. Am Ende jeder Liste steht ein gestricheltes Feld **„+ Eintrag hinzufügen"** — ein Klick darauf hängt einen neuen Eintrag an. Zum Entfernen fährst du über einen Eintrag; oben erscheint ein Papierkorb.

## Blöcke

| Block | Wofür? |
|-------|--------|
| **Hero** | Der große Kopfbereich ganz oben. Nur einmal pro Seite. |
| **Vorteile** | Kacheln mit Symbol, Titel und Text — bis zu 8. |
| **Ablauf** | Nummerierte Schritte — bis zu 6. Die Nummern sind frei änderbar. |
| **Auftragsformular** | Das öffentliche Formular. Nur einmal und **nicht löschbar**. |
| **Text** | Freier Fließtext mit Markdown. |
| **Bild** | Ein einzelnes Bild mit Bildunterschrift. |
| **Text mit Bild** | Text und Bild nebeneinander, Seite wählbar. |
| **Galerie** | Mehrere Bilder im Raster — bis zu 12. |
| **Aufruf zur Aktion** | Hervorgehobener Abschnitt mit Button. |
| **Häufige Fragen** | Aufklappbare Frage-Antwort-Paare — bis zu 20. |

Hero und Auftragsformular sind ausgegraut, sobald sie schon auf der Seite sind.

Das **Auftragsformular kann nicht gelöscht** werden: Die Buttons „Druckauftrag starten" in der Navigationsleiste und im Hero springen zu diesem Block. Ohne ihn liefen sie ins Leere. Ausblenden geht.

## Deutsch und Englisch

Oben rechts schaltest du mit **DE | EN** um, welche Sprachfassung du bearbeitest. Die Seite wechselt mit — was du danach tippst, landet in der gewählten Sprache, die andere bleibt unangetastet.

**Ein englisches Feld darf leer bleiben.** Besucher mit englischer Spracheinstellung sehen dann automatisch den deutschen Text. So musst du nicht alles doppelt pflegen, und es entsteht nie eine leere Stelle. Beim Bearbeiten der englischen Fassung steht der deutsche Text als grauer Platzhalter.

## Zwei Dinge, die im Editor anders sind

- **Links funktionieren nicht.** Sonst würde ein Klick auf einen Button die Seite verlassen, die du gerade bearbeitest. Zum echten Ansehen nutze oben rechts **Ansehen**.
- **Ausgeblendete Blöcke sind blass zu sehen** statt unsichtbar — sonst könntest du sie nie wieder einblenden.

## Berechtigungen

Zum Bearbeiten braucht man das Recht **Landing-Page bearbeiten** (`landing.edit`) aus [[Einstellungen → Rollen & Rechte|settings-roles]]. Admins haben es immer.

Wer es nicht hat, sieht die Seite trotzdem — aber nur als Vorschau, mit gelbem Banner und ohne jede Bedienmöglichkeit. Das Recht ist neu und daher **standardmäßig bei keiner Rolle gesetzt**: Soll ein Teammitglied die Seite pflegen, hak es dort ausdrücklich an.

## Was hier *nicht* geändert wird

- **Navigationsleiste und Fußzeile** sind kein Block. Firmenname und Kontakt-E-Mail stehen unter [[Einstellungen]], die Links auf Impressum und Datenschutz sind fest.
- **Markenfarbe, Logo und Favicon** gehören zu Einstellungen → Marke. Sie steuern die Farbtöne der Symbole gleich mit.
- **Das Auftragsformular selbst** — welche Felder es zeigt, welche Dateien es annimmt — konfigurierst du unter Einstellungen → Auftragsformular. Im Block änderst du nur seine Überschriften.
