---
title: "3D-Viewer & Druckorientierung"
description: "Modelle im Browser betrachten, Notizen setzen und Druckorientierung festlegen"
icon: "Box"
group: "Aufträge & Produktion"
order: 2.2
---

# 3D-Viewer & Druckorientierung

Der integrierte 3D-Viewer ermöglicht es, STL-, OBJ- und 3MF-Dateien direkt im Browser anzuzeigen — ohne externe Software. Du erreichst ihn, indem du in der [[Auftrags-Detailansicht]] auf eine passende Datei klickst.

## Modell öffnen

Klicke in der Dateiliste der [[Auftrags-Detailansicht]] auf eine STL-, OBJ- oder 3MF-Datei. Der Viewer lädt die Datei und zeigt das Modell zentriert an.

## Navigationssteuerung

| Aktion | Maus | Trackpad |
|--------|------|----------|
| **Drehen** | Linke Maustaste gedrückt halten + ziehen | Ein Finger + ziehen |
| **Zoomen** | Mausrad | Zwei-Finger-Pinch |
| **Verschieben** | Rechte Maustaste gedrückt halten + ziehen | Zwei Finger + ziehen |
| **Reset** | Schaltfläche **Ansicht zurücksetzen** in der Toolbar | — |

## Notizen (Annotations)

Du kannst Markierungen direkt auf der Modelloberfläche hinterlassen:

1. Klicke auf das **Notiz-Symbol** (Bleistift/Pin) in der Toolbar.
2. Klicke auf die gewünschte Stelle am Modell.
3. Ein Dialog öffnet sich — gib deinen Kommentar ein.
4. Die Notiz erscheint als farbiger Pin, der beim Überfahren den Text anzeigt.

Notizen sind für alle Teammitglieder sichtbar, nicht für den Kunden.

## Druckorientierung festlegen

Mit dem Flächen-Werkzeug wählst du die Seite des Modells, die auf der Druckplatte aufliegen soll. Das entspricht dem manuellen Ausrichten im Slicer.

### Schritt-für-Schritt

1. Öffne den Viewer und klicke auf das **Flächen-Werkzeug** (Layers/Stapel-Symbol) in der Toolbar — der Modus wird aktiviert.
2. Fahre mit der Maus über das Modell — koplanare Flächen werden **amber-farbig** hervorgehoben.
3. Klicke auf die Fläche, die auf der **Druckplatte** liegen soll.
4. Das Modell dreht sich automatisch so, dass die gewählte Fläche nach unten zeigt. Eine Druckplatten-Vorschau (graue Platte unter dem Modell) erscheint.
5. Klicke **Speichern** in der Aktionsleiste, die jetzt eingeblendet wird.

> **Tipp:** Bei symmetrischen Teilen reicht oft eine grobe Auswahl. Bei asymmetrischen Geometrien (schräge Böden, gebogene Flächen) lohnt es sich, die ideale Orientierung sorgfältig zu wählen.

### Was wird gespeichert?

Die Orientierung wird als Rotationsmatrix in der Datenbank gespeichert. Sie wirkt sich aus auf:

- **Viewer-Anzeige** — beim nächsten Öffnen ist das Modell bereits richtig ausgerichtet (inkl. Bauplatten-Vorschau)
- **3MF-Download** — die Orientierung ist als Transform-Matrix eingebettet (kompatibel mit OrcaSlicer und Bambu Studio)
- **STL-ZIP-Download** — die Geometrie ist vorrotiert, sodass Slicer das Modell korrekt importieren
- **Automatische Druckplanung** — der Planner berücksichtigt den Footprint der rotierten Bounding Box; Z-Rotation bleibt frei (das Teil kann noch gedreht werden)

### Orientierung zurücksetzen

Wenn eine Orientierung gesetzt ist, erscheint in der Toolbar die Schaltfläche **Orientierung zurücksetzen**. Ein Klick darauf entfernt die gespeicherte Orientierung — das Modell kehrt zur Standardlage zurück.

## Downloads

In der Toolbar findest du zwei Download-Optionen:

| Download | Format | Verwendung |
|----------|--------|-----------|
| **3MF exportieren** | `.3mf` | Direkt in OrcaSlicer / Bambu Studio öffnen, inkl. Orientierung |
| **STL-ZIP herunterladen** | `.zip` mit `.stl` | Vorrotierte Geometrie für andere Slicer |

## Unterstützte Dateiformate

| Format | Besonderheiten |
|--------|----------------|
| **STL** | Standardformat, binär und ASCII unterstützt |
| **OBJ** | Inkl. Materialien (MTL), sofern hochgeladen |
| **3MF** | Eingebettete Metadaten (Farben, Orientierungen) werden ausgelesen |
