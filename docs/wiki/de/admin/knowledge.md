---
title: "Wissensdatenbank"
description: "Problem-/Lösungs-Einträge pflegen, mit Tags, Dateianhängen und Wiki-Links"
route: "/admin/knowledge"
icon: "BookOpen"
group: "Wissen & Verwaltung"
order: 7
---

# Wissensdatenbank

Die Wissensdatenbank sammelt wiederkehrende Probleme und bewährte Lösungen rund um den 3D-Druck. Jedes Teammitglied kann Einträge anlegen und bearbeiten.

![Wissensdatenbank Übersicht](/wiki-screenshots/knowledge.png)

## Eintrag erstellen

1. Klicke **+ Eintrag**.
2. Fülle **Problem** (kurze Beschreibung) und **Lösung** (detaillierte Erklärung) aus.
3. Vergib **Tags** für einfaches Wiederfinden.
4. Optional: Dateien anhängen.
5. Klicke **Speichern**.

## Eintrag bearbeiten

Öffne einen Eintrag per Klick und klicke auf das **Bearbeiten-Symbol** (Stift). Alle Felder können jederzeit geändert werden.

## Eintrag löschen

Klicke im Eintrag auf das **Papierkorb-Symbol** und bestätige den Dialog. Das Löschen entfernt auch alle Dateianhänge.

## Suche und Filter

- **Suchfeld** — filtert Einträge in Echtzeit nach Titel, Problem, Lösung und Tags
- **Tag-Klick** — zeigt nur Einträge mit diesem Tag

## Tags

Tags sind frei definierbar — gib einfach einen Begriff ein und drücke Enter oder Komma. Du kannst beliebig viele Tags pro Eintrag vergeben. Empfohlene Tags: Materialnamen (`PLA`, `PETG`), Problemkategorie (`Haftung`, `Stringing`, `Warping`), Drucker-Modell.

## Markdown-Formatierung

Sowohl **Problem** als auch **Lösung** unterstützen Markdown-Formatierung:

| Syntax | Ergebnis |
|--------|----------|
| `**fett**` | **fett** |
| `*kursiv*` | *kursiv* |
| `` `code` `` | `code` |
| ` ```codeblock``` ` | Mehrzeiliger Codeblock |
| `# Überschrift` | Abschnittsüberschrift |
| `- Listenpunkt` | Aufzählungsliste |
| `1. Schritt` | Nummerierte Liste |
| `- [ ] Aufgabe` | Aufgabenliste (Checkbox) |
| `\| Tabelle \|` | Tabelle (GFM-Syntax) |

## Wiki-Links zwischen Einträgen

Du kannst andere Wissensdatenbank-Einträge direkt verlinken:

```
[[Titel des anderen Eintrags]]
```

Beim Tippen von `[[` erscheint ein Autovervollständigungs-Dropdown mit passenden Einträgen. Wähle einen aus oder schreibe den Titel vollständig. Verlinkte Einträge erscheinen in der gerenderten Ansicht als klickbare Chips.

Wenn ein verlinkter Eintrag gelöscht oder umbenannt wird, wird der Link als nicht aufgelöster Verweis angezeigt (mit `?`-Symbol).

## Dateianhänge

Pro Eintrag können mehrere Dateien angehängt werden:

1. Klicke im Eintrag auf **Datei anhängen**.
2. Wähle Bilder (JPG, PNG, GIF, WebP), PDFs oder STL-Dateien.
3. Dateien erscheinen als Liste im Eintrag und können per Klick heruntergeladen werden.

Anhänge sind besonders nützlich für Referenzbilder (z. B. Foto eines Fehldrucks), Slicer-Einstellungen als Screenshot oder Test-STL-Dateien.
