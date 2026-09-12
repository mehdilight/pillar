---
title: The dashboard
summary: A tour of the CMS — overview, entries, content types, media, navigation, settings and publishing — and what each screen writes.
section: editing
order: 40
---
`pillar dev` serves the dashboard at `/`. Everything on the left is content; **Customize** opens the [visual editor](/docs/visual-editor/); the pill at the top shows the branch and how many files are uncommitted.

## Overview

The site, its branch, how many entries it has and how many files are uncommitted; its collections; recently edited entries; the latest commits.

## Collections

Each collection is in the sidebar with its entry count. Its list has **All / Published / Drafts** filters, search by title or slug, pages of twenty, and **New entry**.

## An entry

- **Title** at the top, and the **content** below it in a visual editor: headings, bold, italic, strikethrough, code, links, lists, quotes, code blocks, rules, tables and images from the media library, with undo and redo. The toolbar stays in view while you scroll.
- **Markdown** switches to the source. What you type there is stored exactly as typed.
- **Details** holds the collection's fields, in schema order — short ones two to a row.
- The sidebar: **Publish** (*Published* switch, Save, Preview, Delete), **URL** (the slug, fixed once created), and plugin panels such as **Search & sharing**.

Save with the button or `⌘S`. Leaving with unsaved changes asks first. Saving a published entry checks its [rules](/docs/rules-and-conditions/); a draft saves regardless.

**What a save changes.** Frontmatter lines you did not touch are kept byte-for-byte. The body is written as markdown: a paragraph wrapped over several lines is joined the first time it is edited visually, and tables are re-aligned. To keep a file's exact formatting, edit it in the Markdown view.

## Content types

Every collection, its fields and its template. **Edit fields** opens the field builder in a drawer; **New content type** creates one. See [Content types](/docs/content-types/).

## Media

The [media library](/docs/media-library/): upload, filter, search, alt text, where each image is used.

## Navigation

The [link lists](/docs/navigation/) themes show as menus.

## Settings

Plugin settings — such as the SEO plugin's *Search & sharing*, which save as you type — and the site's details from `site.json`. Theme settings (colours, widths) are edited in the visual editor, with the preview beside them; this screen links there.

## Publish

The uncommitted files, a commit message, **Commit & publish** — with *Push to the remote after committing*, on by default — and the recent history. **Discard** throws away every uncommitted change in the editor's paths, including files added since the last commit. See [Publishing](/docs/publishing/).

## Working offline

The dashboard also runs with no server behind it — `npm run dev` in `apps/editor` without `pillar dev` — on built-in sample data, which is how its own development works. The top bar says so.
