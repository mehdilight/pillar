---
title: About
---
Pillar is a static site generator with a visual editor, built on
[Liqx](https://github.com/phpmystic/liqx) — a JSX-flavoured template language
for PHP that keeps the section/schema model but swaps `{{ }}` for real HTML
and real expressions.

The whole product is three commands:

- `pillar dev` — a dashboard and a live preview, on your machine
- `pillar build` — the site, as plain HTML files
- `pillar deploy` — those files, on whichever host you use

There is no database. A site is a directory: templates and content are files,
saving is `file_put_contents`, and git is the store — draft is the working
tree, publish is a commit, history is `git log`.
