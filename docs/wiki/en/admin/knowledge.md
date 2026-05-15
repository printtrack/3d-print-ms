---
title: "Knowledge Base"
description: "Maintain problem/solution entries with tags, file attachments and wiki links"
route: "/admin/knowledge"
icon: "BookOpen"
group: "Knowledge & Admin"
order: 7
---

# Knowledge Base

The knowledge base collects recurring problems and proven solutions related to 3D printing. Any team member can create and edit entries.

![Knowledge Base overview](/wiki-screenshots/knowledge.png)

## Creating an entry

1. Click **+ Entry**.
2. Fill in **Problem** (short description) and **Solution** (detailed explanation).
3. Add **tags** for easy retrieval.
4. Optionally attach files.
5. Click **Save**.

## Editing an entry

Open an entry by clicking it and click the **edit icon** (pencil). All fields can be changed at any time.

## Deleting an entry

Click the **trash icon** in the entry and confirm the dialog. Deleting also removes all file attachments.

## Search and filter

- **Search field** — filters entries in real time by title, problem, solution, and tags
- **Tag click** — shows only entries with that tag

## Tags

Tags are freely defined — just type a term and press Enter or comma. You can add as many tags as you like per entry. Recommended tags: material names (`PLA`, `PETG`), problem category (`Adhesion`, `Stringing`, `Warping`), printer model.

## Markdown formatting

Both **Problem** and **Solution** support Markdown formatting:

| Syntax | Result |
|--------|--------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `code` |
| ` ```codeblock``` ` | Multi-line code block |
| `# Heading` | Section heading |
| `- item` | Bullet list |
| `1. Step` | Numbered list |
| `- [ ] task` | Task list (checkbox) |
| `\| Table \|` | Table (GFM syntax) |

## Wiki links between entries

You can link other knowledge base entries directly:

```
[[Title of the other entry]]
```

Typing `[[` shows an autocomplete dropdown with matching entries. Select one or write the full title. Linked entries appear as clickable chips in the rendered view.

If a linked entry is deleted or renamed, the link is shown as an unresolved reference (with a `?` icon).

## File attachments

Multiple files can be attached per entry:

1. Click **Attach file** in the entry.
2. Select images (JPG, PNG, GIF, WebP), PDFs, or STL files.
3. Files appear as a list in the entry and can be downloaded by clicking.

Attachments are especially useful for reference images (e.g. photo of a failed print), slicer setting screenshots, or test STL files.
