// Shared wikilink utilities — used by KnowledgeManager and WikiMarkdown.

// Converts [[Title]] to [Title](wikilink:<encoded>) so react-markdown handles it.
export function preprocessWikilinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, title) =>
    `[${title}](wikilink:${encodeURIComponent(title)})`
  );
}

// Strips markdown image syntax and [[wikilinks]] to plain text for card previews.
export function stripWikilinks(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .trim();
}
