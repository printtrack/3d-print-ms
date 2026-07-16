---
title: "Landing page"
description: "Edit your public landing page on the page itself: text, icons, images, order"
route: "/admin/landing"
icon: "LayoutTemplate"
group: "Knowledge & Admin"
order: 7.5
---

# Landing page builder

Your public landing page — what visitors see at `/` — is made of **blocks**. Each block is one section of the page.

**You edit it on the page itself.** There is no form beside it: you see your landing page, you click into it, and you change what you see — text, icons, tones, images, order. What you do is the result.

![Landing page builder](/wiki-screenshots/landing.png)

## Customizing the page for the first time

Until you change something, the landing page shows the built-in default content. You will see the notice *"This page still uses the default content"*, and nothing is clickable yet.

Click **Customize page**. This turns the default content into editable blocks — the page looks exactly the same afterwards, but it is now yours. You only do this once.

Changes **save automatically**, about a second after you stop. There is no save button — but saved does not mean public yet (see Draft and publishing).

## Draft and publishing

Everything you edit is a **draft**. Visitors do not see it — they see the last **published** version. So you can rebuild the page at your own pace without half-finished states going live.

At the top right you see the status:

- **Published** — the draft and the public page are the same.
- **Draft – not published** — you have changes no one but you can see yet.

Two buttons:

- **Publish** — makes your draft the public page. Only now do visitors see the changes.
- **Discard** — resets the draft to the last published version. Everything since the last publish is gone (with a confirmation).

As long as you have never published, the public page keeps showing the default content — even after you have clicked "Customize page" and changed things. Nothing goes public until you click **Publish**.

## Changing text

Hover over any text: it picks up a dashed outline. Click into it and type, right where the text will sit.

Empty fields stay visible in the editor as "…" so you can fill them again. On the real page they disappear.

## Icons and tones

Click an icon in the *Features* tiles. A picker opens with twelve symbols and six tones.

The tones are **not a free colour picker — they are shades of your brand colour** from Settings → Brand. That is deliberate: change your colour there later and every icon follows. Free colours would leave them wearing the old brand, and the page would drift further apart with every rebrand.

## Images

Click an image (or the dashed placeholder where there is none yet). You can replace it, remove it, and set the **image description** that screen readers read out — it appears nowhere on the page, so this is the only place for it.

JPG, PNG, WebP, GIF and SVG up to 5 MB are allowed. The server checks the file: anything merely *named* like an image is rejected. Only your own uploads can be used, not links to other sites — the page's security policy would block those anyway, and they would break one day.

## Body text with formatting

In the **Text** and **Text with image** blocks, clicking the body opens its Markdown source:

- `**bold**` and `*italic*`
- `# Heading`, `## Smaller heading`
- `- item` for lists
- `[link text](https://example.com)` for links

Why not type directly, as with the rest? Because typing into formatted text would flatten the formatting — bold, lists and links would be gone after the first edit.

## Buttons

Button text is clickable and editable in place. **Where** a button goes is not visible, so a small chain icon sits beside it:

- `#order-form` — jumps to the order form on the same page
- `/portal/signin` — to the customer portal
- `https://…` — to an external site

## The block toolbar

Hover a block: a toolbar appears at its top right and follows you for as long as the block is on screen. It holds:

| Icon | What for? |
|------|-----------|
| ↑ ↓ | Move the block up or down |
| Palette | Background: white, grey or dark. Text colours adjust automatically |
| Eye | Hide the block. It leaves the public page but stays in the editor — useful to prepare a section, or take one down for a while |
| Plus | Insert a new block **directly below** |
| Bin | Delete the block (with a confirmation) |
| Lock | Instead of the bin on the order form — see below |

At the end of the page there is also **Add block**, to append one.

## List entries

Features, steps, gallery images and questions are lists. At the end of each list is a dashed **"+ Add entry"** field — clicking it appends a new entry. To remove one, hover an entry; a bin appears above it.

## Blocks

| Block | What for? |
|-------|-----------|
| **Hero** | The large header at the top. Once per page. |
| **Features** | Tiles with an icon, title and text — up to 8. |
| **How it works** | Numbered steps — up to 6. The numerals are editable. |
| **Order form** | The public form. Once per page and **not deletable**. |
| **Text** | Free-flowing text with Markdown. |
| **Image** | A single image with a caption. |
| **Text with image** | Text and image side by side, either way round. |
| **Gallery** | Several images in a grid — up to 12. |
| **Call to action** | A highlighted section with a button. |
| **FAQ** | Collapsible question-and-answer pairs — up to 20. |

Hero and Order form are greyed out once they are already on the page.

The **order form cannot be deleted**: the "Start a print order" buttons in the navigation bar and hero jump to this block. Without it they would lead nowhere. You can hide it.

## German and English

Use the **DE | EN** switch at the top right to pick which language you are editing. The page follows — whatever you type then lands in that language, and the other is left alone.

**An English field may be left empty.** Visitors using English then automatically see the German text. That way you do not maintain everything twice, and the page never has a blank spot. While editing English, the German text shows as a grey placeholder.

## Two things that differ in the editor

- **Links do not work.** Otherwise clicking a button would navigate away from the page you are editing. Use **View** at the top right for the real thing.
- **Hidden blocks appear faded** rather than gone — otherwise you could never bring them back.

## Permissions

Editing requires the **Edit landing page** permission (`landing.edit`) from [[Settings → Roles & permissions|settings-roles]]. Admins always have it.

Anyone without it still sees the page — but only as a preview, with an amber banner and no controls at all. The permission is new and therefore **not set on any role by default**: if a team member should maintain the page, tick it explicitly.

## What is *not* changed here

- **Navigation bar and footer** are not blocks. Company name and contact email live in [[Settings]]; the imprint and privacy links are fixed.
- **Brand colour, logo and favicon** belong to Settings → Brand. They drive the icon tones too.
- **The order form itself** — which fields it shows, which files it accepts — is configured under Settings → Order form. The block only changes its headings.
