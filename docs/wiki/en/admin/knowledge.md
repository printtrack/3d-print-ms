---
title: "Knowledge Base"
description: "Maintain problem/solution entries with tags and file attachments"
route: "/admin/knowledge"
icon: "BookOpen"
group: "Knowledge & Admin"
order: 7
---

# Knowledge Base

The knowledge base collects recurring problems and proven solutions related to 3D printing. Any team member can create and edit entries.

## Creating an entry

1. Click **+ Entry**.
2. Fill in **Problem** and **Solution** — Markdown is supported.
3. Add **tags** for easy retrieval.
4. Optionally attach files (photos, design files, references).

## Wiki links

In the "Problem" and "Solution" fields you can link other entries:

```
[[Title of the other entry]]
```

Typing `[[` opens autocomplete. Linked entries appear as clickable chips.

## Search and filter

- The search field filters entries in real time by title, problem, solution, and tags.
- Click a tag to show only entries with that tag.

## File attachments

Multiple files can be attached per entry (images, PDFs, STL files). They are visible in the entry detail and downloadable.

## Markdown support

Both fields (Problem and Solution) support Markdown:

- `**bold**`, `*italic*`
- `# Heading`
- ` ```code block``` `
- Tables (GFM syntax)
- Task lists: `- [x] done`
