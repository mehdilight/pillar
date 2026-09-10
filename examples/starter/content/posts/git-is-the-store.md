---
title: Git is the store
date: 2026-09-07
tags: [design]
---
A visual editor usually needs a database: somewhere to keep the draft, the published version, and enough history to roll back. Three tables, minimum.

With the site in a repository, all three already exist:

| What an editor needs | What git already is |
| -------------------- | ------------------- |
| draft                | the working tree    |
| publish              | a commit            |
| history              | `git log`           |
| rollback             | `git revert`        |

So the dashboard writes files and stages nothing else. Publishing commits the four paths the editor owns — `templates/`, `config/`, `content/`, `assets/` — and leaves a developer's half-finished template alone.

![](/assets/uploads/screenshot-2026-09-06-at-16-42-09-d23fb7a8a8.png)
