---
title: "Wissensdatenbank"
description: "Problem-/Lösungs-Einträge pflegen, mit Tags und Dateianhängen"
route: "/admin/knowledge"
icon: "BookOpen"
group: "Wissen & Verwaltung"
order: 7
---

# Wissensdatenbank

Die Wissensdatenbank sammelt wiederkehrende Probleme und bewährte Lösungen rund um den 3D-Druck. Jeder Teammitglied kann Einträge anlegen und bearbeiten.

## Eintrag erstellen

1. Klicke **+ Eintrag**.
2. Fülle **Problem** und **Lösung** aus — Markdown wird unterstützt.
3. Vergib **Tags** für einfaches Wiederfinden.
4. Optional: Dateien anhängen (Fotos, Design-Dateien, Referenzen).

## Wikilinks

In den Feldern "Problem" und "Lösung" kannst du andere Einträge verlinken:

```
[[Titel des anderen Eintrags]]
```

Beim Tippen von `[[` öffnet sich eine Autovervollständigung. Verlinkte Einträge erscheinen als klickbare Chips.

## Suche und Filter

- Suchfeld filtert Einträge in Echtzeit nach Titel, Problem, Lösung und Tags.
- Klick auf einen Tag zeigt nur Einträge mit diesem Tag.

## Dateianhänge

Pro Eintrag können mehrere Dateien angehängt werden (Bilder, PDFs, STL-Dateien). Sie sind im Eintrag-Detail sichtbar und herunterladbar.

## Markdown-Unterstützung

Beide Felder (Problem und Lösung) unterstützen Markdown:

- `**fett**`, `*kursiv*`
- `# Überschrift`
- ` ```code block``` `
- Tabellen (GFM-Syntax)
- Aufgabenlisten: `- [x] erledigt`
