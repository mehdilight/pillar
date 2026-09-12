---
title: Navigation
summary: Link lists — the header menu, footer columns — kept in data/menus.json, edited on the Navigation screen, and read by templates as menus.
section: content
order: 26
---
## The file

`data/menus.json` holds named link lists:

```json
{
  "main": {
    "title": "Main menu",
    "items": [
      { "title": "Docs", "url": "/docs/introduction/", "items": [
        { "title": "Quick start", "url": "/docs/quick-start/" }
      ] },
      { "title": "Changelog", "url": "/blog/" }
    ]
  },
  "footer": { "title": "Footer", "items": [ { "title": "About", "url": "/about/" } ] }
}
```

- The key is the list's **handle**: lowercase letters, digits and hyphens.
- Every link needs a `title` and a `url`; `items` nests sub-links.

## In templates

Every template sees `menus`. A section names the list it shows with a setting of type `menu`, so the site owner can point it at another:

```html
<nav>
  {menus[section.settings.menu].items.map((link) =>
    <div class="nav-item">
      <a href={link.url}>{link.title}</a>
      <if {link.items}>
        <div class="nav-submenu">{link.items.map((child) => <a href={child.url}>{child.title}</a>)}</div>
      </if>
    </div>
  )}
</nav>
<schema>
{ "name": "Header", "settings": [ { "id": "menu", "type": "menu", "label": "Navigation menu", "default": "main" } ] }
</schema>
```

For a list that might not exist, use `menus[name]?.items ?? []`.

## Editing

**Navigation** in the dashboard lists every link list with a summary of its links. Open one to edit it: **Add menu item**, drag to reorder, and add sub-links under an item. The link field's **Browse** picker offers the site's pages and every collection's entries, searchable — or type any address. **Create menu** starts a new list; its handle comes from its title.

The starter's header shows one list, and its footer shows one list per [column block](/docs/blocks/) — this site's footer columns are the `learn`, `build` and `reference` lists.
