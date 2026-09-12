---
title: Collections and entries
summary: Every folder in content/ is a collection and every markdown file in it an entry — with a URL from its file name, frontmatter for its fields, and a template to render it.
section: content
order: 20
---
## An entry

`content/posts/git-is-the-store.md`:

```markdown
---
title: Git is the store
date: 2026-09-07
tags: [design]
summary: Why Pillar has no database.
---
A visual editor usually needs a database: somewhere to keep the draft…
```

- The **collection** is the folder: `posts`.
- The **slug** is the file name: `git-is-the-store`. It is the URL, so it is fixed once an entry exists.
- The **frontmatter** holds its fields; the **body** is markdown (CommonMark; raw HTML is allowed).

## URLs

| Collection | URL |
| --- | --- |
| `pages` | `/<slug>/` — pages own the root: `content/pages/about.md` is `/about/` |
| anything else | `/<collection>/<slug>/` — `/posts/git-is-the-store/` |

Each entry renders through its collection's template — `post.json` for `posts` — or `page.json`, or the template its frontmatter names with `template:`. See [Templates and sections](/docs/templates-and-sections/).

## Fields every entry understands

| Key | Effect |
| --- | --- |
| `title` | The entry's title everywhere; the slug when absent. |
| `date` | Shown by themes; dated collections list newest first. |
| `draft: true` | Rendered in the dev preview, left out of `pillar build` (unless `--drafts`) and out of every listing and relationship in production. |
| `order` | An explicit position — see below. |
| `template` | Render through another template. |
| `tags` | A list, available as `page.tags`. |

Any other key is simply available to templates: write `subtitle:` and `{page.subtitle}` works, no configuration needed. Declare fields in a [content type](/docs/content-types/) to get a form for them in the dashboard.

## Order

A collection reads in one order, so templates need not sort it again:

1. entries with an `order:` first, lowest to highest — documentation is a sequence;
2. otherwise, newest `date` first — a blog;
3. otherwise, by slug.

An entry with no position sorts after every entry that has one.

## In templates

The current entry is `page`; every collection is under `collections`:

```html
<h1>{page.title}</h1>
<time datetime={page.date}>{page.date}</time>
{page.content}

<ul>
  {collections.posts.items.slice(0, 3).map((post) =>
    <li><a href={post.url}>{post.title}</a> — {post.excerpt}</li>
  )}
</ul>
```

An entry offers `title`, `slug`, `collection`, `url`, `content` (the rendered HTML), `excerpt` (the first 200 characters of text), `date`, `tags`, `draft`, and every frontmatter key. A collection offers `items`, `size`, `first` and `name`.

Reading a collection in a template records it as a dependency: when any entry in it changes, pages listing it rebuild. See [Building](/docs/building/).

## Markdown

Bodies render through CommonMark with raw HTML allowed. Images get the treatment described in [Images](/docs/images/): resized copies in `srcset`, dimensions, lazy loading, and alt text from the media library when the markdown gives none. In the dashboard, entries are written in a visual editor that reads and writes markdown — see [The dashboard](/docs/dashboard/).
