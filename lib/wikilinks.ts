// Shared wikilink utilities — used by KnowledgeManager and WikiMarkdown.

// Converts [[Title]] and [[Label|slug-or-title]] to markdown links.
// [[Title]]         → [Title](wikilink:Title)
// [[Label|target]]  → [Label](wikilink:target)  (target looked up by slug or title)
export function preprocessWikilinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    const pipeIdx = inner.indexOf("|");
    if (pipeIdx !== -1) {
      const label = inner.slice(0, pipeIdx).trim();
      const target = inner.slice(pipeIdx + 1).trim();
      return `[${label}](wikilink:${encodeURIComponent(target)})`;
    }
    return `[${inner}](wikilink:${encodeURIComponent(inner)})`;
  });
}

// Strips markdown image syntax and [[wikilinks]] to plain text for card previews.
export function stripWikilinks(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .trim();
}
