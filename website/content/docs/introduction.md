---
title: Introduction
summary: Pillar is a static site generator with a CMS and a visual editor built in. Your site stays files in git; the build turns them into plain HTML.
section: start
order: 1
---
Pillar builds websites from a folder of files: markdown for content, JSON for page layouts and settings, and Liqx templates for design. It runs on your machine. Point it at a site and you get three things on one port:

- a **dashboard** — a CMS for entries, content types, media, navigation and settings;
- a **visual editor** — pages made of sections and blocks, edited beside a live preview;
- a **preview** of the site, rendered by exactly the code the build uses.

When you are done, `pillar build` writes plain HTML, CSS and images to `dist/`. Any static host can serve it.

## What makes it different

**The files are the database.** Everything the dashboard changes is an ordinary file in your site's folder — a markdown entry, a template's JSON, `config/settings_data.json`. There is no database to back up, migrate or run in production, and nothing the dashboard writes is something you could not have typed yourself. Hand edits and dashboard edits are the same thing.

**Git is the history.** The working tree is the draft. Publishing is a commit — pushed, if the site has a remote. Rollback is `git revert`. The dashboard shows what is uncommitted and lets you publish or discard it.

**The template declares its own editing surface.** A section template carries a `<schema>` block listing its settings — a heading, an image, a colour. That block is the whole contract: the visual editor draws exactly those controls, the build casts exactly those values, and nothing else can be changed.

**Local-first.** There are no accounts and no hosted service. Collaboration is whatever your git workflow already is.

## Who it is for

- **Developers** who want a static site with a real editing experience for the people who write on it — without running a headless CMS.
- **Writers and editors** who want to change a page and see it, not learn YAML — while everything they do still ends up as a readable diff.
- **Teams** already reviewing changes in pull requests: a Pillar edit is a commit like any other.

## A tour of this documentation

- **Start here** — install Pillar, make a site, and learn the model: [Quick start](/docs/quick-start/), [How Pillar works](/docs/how-it-works/), [Project structure](/docs/project-structure/).
- **Building sites** — templates, sections, blocks, the `<schema>` block, theme settings, and layering themes and addons.
- **Content** — collections, content types, every field type, rules, relationships, pagination and menus.
- **Media** — the media library, alt text, files, and images resized at build time.
- **Editing** — the dashboard and the visual editor, screen by screen.
- **Build and publish** — incremental builds, publishing with git, and deploying `dist/`.
- **Extending** — plugins, and the SEO plugin that ships with Pillar.
- **Reference** — the CLI, `site.json`, filters and globals, `pillar check`, and the dev server's API.

This site is itself a Pillar site: the `website/` folder of the Pillar repository, built on the starter theme as an addon. Everything described here is running underneath the page you are reading.
