---
title: Publishing
summary: Saving writes files; publishing commits them — and pushes, unless you ask it not to. Drafts, discard and history are all git.
section: publishing
order: 51
---
## Save, then publish

**Saving** in the dashboard writes a file. Nothing is committed, so you can save as often as you like, preview, and change your mind.

**Publishing** — the Publish screen, or the dialog in the visual editor — commits every uncommitted change in the editor's paths:

```text
templates/   config/   content/   assets/
```

and nothing else. A developer's half-finished section in `sections/` is never swept into a content commit.

With a remote configured, publishing also **pushes**. Untick *Push to the remote after committing* to commit locally only — to review the commit first, or because you are offline — and push later with git or by publishing again.

## Drafts

Two kinds, and they are different:

- **Uncommitted changes** are the working tree: visible in the preview, not yet in history.
- **Draft entries** (`draft: true`, the *Published* switch off) are committed and shared, but left out of production builds, listings and relationships until published. [Rules](/docs/rules-and-conditions/) apply once an entry is published.

## Discard

**Discard changes** puts the editor's paths back to the last commit — `git checkout` for edited files, and deleting files added since. It cannot be undone; the dashboard says how many files it will affect.

## History and rollback

The Publish screen and the Overview show recent commits. Rolling back is `git revert` — Pillar does not need its own undo history for publishing, because git already is one.

## Without git

A site that is not a repository works fully; the dashboard simply has nothing to publish to, and says so.
