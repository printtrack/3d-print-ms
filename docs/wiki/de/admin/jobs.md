---
title: "Druckjobs"
description: "Druckaufträge planen, starten, abschließen und automatisch weiterschalten"
route: "/admin/jobs"
icon: "Layers"
group: "Aufträge & Produktion"
order: 3
---

# Druckjobs

Druckjobs verwalten die tatsächliche Produktion auf den [[Einstellungen → Maschinen|settings-machines]]. Ein Job kann mehrere [[Aufträge]] bündeln und läuft auf genau einer Maschine.

![Druckjobs Übersicht](/wiki-screenshots/jobs.png)

## Ansichten

Oben rechts schaltest du zwischen **Gantt** (Standard) und **Board** um.

### Gantt-Ansicht

Zeigt alle Jobs als horizontalen Zeitstrahl (ähnlich einem Gantt-Diagramm), geordnet nach Startzeit und Maschine. Du siehst auf einen Blick:

- Welche Maschine wann belegt ist
- Wie lange ein Job dauert (sofern Druckzeit eingetragen)
- Überlappungen oder freie Zeitfenster

Klick auf einen Job öffnet die Detailansicht rechts.

### Board-Ansicht

Zeigt Jobs je Maschine als Kanban-Spalte, von oben nach unten in Warteschlangen-Reihenfolge. Die Board-Ansicht eignet sich besonders zum:

- Erstellen neuer Jobs per **+ Job**-Button in der Maschinenspalte
- Schnellen Überblick über die aktuelle Auslastung jeder Maschine
- Manuellen Statuswechseln

> Ausführliche Erklärung des Boards → [[Druckjob erstellen & verwalten|jobs-create]]

## Job-Status

| Status | Bedeutung | Farbe |
|--------|-----------|-------|
| **Geplant** | Startzeitpunkt liegt in der Zukunft | Grau |
| **In Bearbeitung** | Aktuell auf der Maschine | Blau |
| **Fertig** | Druckzeit abgelaufen oder manuell abgeschlossen | Grün |

## Auto-Transition (automatischer Statuswechsel)

Das System überprüft alle 60 Sekunden, ob Jobs automatisch weitergeschaltet werden müssen:

**Geplant → In Bearbeitung**
: Sobald der eingetragene Startzeitpunkt erreicht ist.

**In Bearbeitung → Fertig**
: Sobald `Startzeit + Druckzeit (Minuten)` abgelaufen ist. Falls kein `Startzeit` gesetzt ist, wird `plannedAt + Druckzeit` verwendet.

> Jobs **ohne** eingetragene Druckzeit rechnen mit einer Standarddauer von 2 Stunden — genauso lang, wie ihr Balken auf der Zeitachse gezeichnet wird. Sie springen also ebenfalls auf **Verifikation ausstehend**; du bestätigst das Ergebnis dann wie gewohnt beim Verifizieren.

Automatische Statuswechsel werden im Audit-Log ohne Benutzerangabe protokolliert.

## Filament-Verbrauch

Im Job-Detail erfasst du verwendete Filamente mit Gramm-Angabe. Der eingetragene Verbrauch wird automatisch vom Lagerbestand im [[Inventar]] abgezogen.

## Automatische Druckplanung

Die **Bündelung** läuft vollautomatisch, die **Terminierung** entscheidest du. Sobald ein Teil druckbereit ist, wird beim nächsten Aufruf der Jobs-Seite (und danach alle 60 Sekunden) ein passender Druckjob gebildet:

1. Das System liest alle druckbereiten Teile (Teilphase: Druckbereit) aus offenen Aufträgen.
2. Es löst die **Material-/Farbanforderung** jedes Teils zu einer konkreten Spule auf und gruppiert Teile mit gleicher Spule.
3. Es berechnet den Footprint jedes Teils anhand seiner Bounding Box.
4. Es verteilt die Teile per Bin-Packing auf die verfügbaren Maschinen — passende Teile werden zu einem Job zusammengelegt, bestehende noch nicht gestartete Jobs werden aufgefüllt.

Neue Jobs liegen zunächst **ohne Termin** im Bereich „Nicht geplant". Auf die Zeitachse kommen sie entweder per **Drag & Drop** oder über den Button **Auf Zeitachse planen**.

### Auf Zeitachse planen

Der Button terminiert alle noch ungeplanten Jobs auf einen Schlag:

- **Frist zuerst:** Jobs werden nach der frühesten Auftragsfrist der enthaltenen Teile einsortiert.
- **Wenig Rüstzeit:** Sind mehrere Jobs ähnlich dringend (Fristen höchstens 48 Stunden auseinander), läuft zuerst der Job, der mit dem bereits geladenen Filament auskommt — so entstehen möglichst wenige Filamentwechsel.
- Jeder Job bekommt das früheste freie Zeitfenster seiner Maschine, frühestens 30 Minuten in der Zukunft (Vorlauf zum Bestücken), überschneidungsfrei und ohne Wartungsfenster. Ist ein Wechsel nötig, werden zusätzlich 15 Minuten Rüstzeit reserviert.
- **Bereits terminierte Jobs werden nie verschoben** — was du von Hand gelegt hast, bleibt liegen.

**Nicht einplanbare Teile:** Kann ein druckbereites Teil nicht zugeordnet werden, erscheint oben rechts der Hinweis **„N Teile nicht einplanbar"**. Ein Klick zeigt jedes Teil mit Begründung (kein passendes Filament, keine STL-Datei, zu groß für alle Drucker …) und verlinkt in den Auftrag.

### Automatische Neuplanung bei Änderungen

Ändert sich ein bereits verplantes Teil, wird es **automatisch aus dem Job herausgenommen und neu eingeplant**. Ausgelöst wird das durch:

- Wechsel von **Farbe** oder **Material**
- Änderung der **Menge**
- **Neues Design** (neue Designdatei — dabei wird auch die gespeicherte Bounding Box neu vermessen)
- Neue oder zurückgesetzte **Druckorientierung**
- Verlassen der Phase **Druckbereit**

Das gilt nur, solange der Job **noch nicht im Druck** ist. Läuft der Druck bereits oder wurde die Platte schon an den Drucker geschickt, bleibt das Teil im Job — die Entscheidung liegt dann bei dir. Läuft ein Job durch das Herausnehmen leer, wird er entfernt. Jede Neuplanung steht im Audit-Log des Auftrags.

### Filamentwechsel

Jeder Drucker hat unter [[Einstellungen → Maschinen|settings-machines]] eine Anzahl **Materialplätze** (1 = Einzelextruder, mehr = AMS/MMU) und ein **geladenes Filament** je Platz. Daraus weiß PrintTrack, wann jemand die Spule tauschen muss.

- Braucht ein Job ein Filament, das nicht geladen ist, wird er als **Filamentwechsel nötig** markiert — im Board als gelbes Chip, auf der Zeitachse als gestrichelter Rahmen mit ⇄.
- Im Job-Detail steht, was zu tun ist („PLA Rot entnehmen, PETG Blau einlegen"). Der Button **Wechsel erledigt** bestätigt den Tausch und schreibt die neuen Spulen in die Materialplätze des Druckers.
- **Bis der Wechsel bestätigt ist, startet der Job nicht.** Erreicht er seinen Termin, wird er stattdessen um 15 Minuten nach hinten geschoben — so druckt nie jemand versehentlich mit der falschen Farbe.

Auf Druckern mit mehreren Materialplätzen fasst der Planer Teile verschiedener Spulen zu einem Job zusammen — allerdings nur Spulen, die dort auch **geladen** sind, denn sonst wäre der gemeinsame Job wieder ein Wechsel. Bei Einzelextrudern (Standard) enthält ein Job immer genau ein Filament.

**Druckerwahl:** Der Planer bevorzugt den Drucker, in dem die benötigte Spule schon steckt — das spart den Wechsel. Steckt sie nirgends, bekommt der Drucker mit der geringsten geplanten Auslastung den Job, damit die Arbeit sich verteilt.

### Rüstzeit, Wartezeit und Anwesenheit auf der Zeitachse

Ein Balken auf der Zeitachse zeigt, wie lange der **Drucker belegt** ist — und das ist mehr als die reine Druckzeit:

| Darstellung | Bedeutung |
|-------------|-----------|
| Gelbe Schraffur **vor** dem Balken | Rüstzeit: ein Filamentwechsel steht noch aus |
| Voller Balken | Der Drucker druckt |
| Graue Schraffur **nach** dem Balken | Fertig, aber niemand vor Ort — die Platte belegt den Drucker bis zur Entnahme |
| Graues Band im Hintergrund | Unbetreute Zeit (Nacht, Wochenende) |

So ist auf einen Blick erklärt, warum ein Job am Montagmorgen nicht anläuft, obwohl der vorherige Druck schon Samstagnacht fertig war: Die Platte lag bis zur Entnahme drauf.

**Beim Verschieben rechnet alles mit.** Ziehst du einen Job auf eine andere Zeit oder Maschine, werden Rüstzeit, Wartezeit und Filamentwechsel sofort neu bestimmt — die Reihenfolge auf dem Drucker ändert sich ja. Liegt der Start außerhalb der Anwesenheitszeiten, markiert ein ☾ den Balken: Zu dieser Zeit kann niemand die Platte bestücken.

**Was beim Ziehen blockiert wird:** Ein Job lässt sich nicht ablegen, wo er nicht laufen kann — in der Vergangenheit, auf einem noch belegten Drucker oder, wenn ein **Filamentwechsel aussteht**, in eine unbetreute Zeit (die Spule muss ja jemand wechseln). Ein Druck ohne Wechsel darf dagegen jederzeit starten, auch nachts — gestartet wird per Fernzugriff. Belegt heißt dabei bis zur **Entnahme**: Solange die fertige Platte des Vorgängers drauf liegt, ist der Drucker besetzt, auch wenn der Druck selbst schon fertig ist. Der Balken färbt sich beim Ziehen rot und beim Loslassen erscheint der Grund.

**Der Bauraum wird auch von Hand geprüft:** Ein Job lässt sich nicht auf einen Drucker ziehen, der zu klein für eines seiner Teile ist — du bekommst eine Meldung mit den konkreten Maßen statt einer Planung, die nie druckbar wäre.

### Offene Filamentwechsel abarbeiten

Steht mindestens ein Wechsel an, erscheint oben rechts **„N Filamentwechsel offen"**. Der Dialog listet alle Wechsel in Druckreihenfolge, nach Drucker gruppiert — du gehst einmal durch die Werkstatt und hakst ab. Jedes Abhaken schreibt die neuen Spulen in die Materialplätze des Druckers und gibt den Job frei.

**Drucker-Auswahl nach Bauraum:** Passt ein Teil nicht auf den zunächst gewählten Drucker, weicht der Planer automatisch auf den nächsten kompatiblen Drucker mit größerem Bauraum aus. Nur wenn es auf **keinen** passenden Drucker passt, landet es in der Liste der nicht einplanbaren Teile.

**Material/Farbe „egal" nutzen:** Teile, bei denen [[in der Teileverwaltung|orders-detail]] die Farbe (oder das Material) auf **egal** steht, kann der Planner flexibel einem passenden konkreten Job zuordnen — so werden Teile zusammengelegt und der Drucker besser ausgelastet. Dabei werden nur Spulen gewählt, deren Drucker das Teil auch tatsächlich fassen können.

**Drucker-Kompatibilität:** Ist ein Filament im [[Inventar]] nur mit bestimmten Druckern kompatibel, plant der Planner das betroffene Material ausschließlich auf diesen Druckern.

**Filament-Knappheit:** Reicht der Lagerbestand rechnerisch nicht, wird trotzdem geplant — der Fehlbestand ist im [[Inventar]] als negative Verfügbarkeit sichtbar, damit die Produktion nicht stillsteht.

Wenn für ein Teil im [[3D-Viewer & Druckorientierung|orders-3dviewer]] eine Druckorientierung gesetzt wurde, verwendet der Planner den Footprint der rotierten Bounding Box — was zu realistischerem Packing führt.

## An Drucker senden

Wenn die Maschine eine [[Einstellungen → Maschinen|settings-machines]]-**Cloud-Verbindung** hat, kannst du die geslicte Datei direkt aus dem Job an den Drucker schicken. Öffne dazu den Job und nutze im Bereich **Drucker** den Button **An Drucker senden**.

Voraussetzung ist eine hochgeladene **Slicing-Datei** (`.gcode`, `.bgcode`, `.3mf`, …) am Job. Ein **Status-Badge** zeigt den Live-Zustand des Druckers (*Bereit*, *Druckt*, *Fertig (Platte belegt)*, *Offline*).

### Auto-Start nur wenn frei

Beim Senden prüft das System den Druckerzustand:

- **Drucker ist frei (Bereit) → sofort starten.** Die Datei wird hochgeladen und der Druck **automatisch gestartet**; der Job wechselt auf **Im Druck**.
- **Drucker druckt noch oder ein fertiges Teil liegt auf der Platte → nur hochladen.** Der Dispatch bleibt auf **Wartet auf Start**. Sobald die Platte frei ist, klickst du **Jetzt starten**.

So wird nie versehentlich auf eine belegte Platte gedruckt. Über das **✕** brichst du einen wartenden oder laufenden Dispatch ab.

Der Job-Status zieht automatisch nach: Meldet der Drucker den Druck als abgeschlossen, wechselt der Job auf **Verifikation ausstehend** — das übernimmt der regelmäßige Abgleich im Hintergrund.

## Subseiten

- [[Druckjob erstellen & verwalten|jobs-create]] — Schritt-für-Schritt: Job anlegen, Aufträge zuweisen, Filament erfassen
