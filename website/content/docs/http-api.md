---
title: Dev server API
summary: The JSON API pillar dev serves at /api/ — what the dashboard uses, and what scripts can use too.
section: reference
order: 74
---
`pillar dev` serves a JSON API over the site's working tree at `/api/`. The dashboard is built entirely on it, so anything the dashboard does, a script can do. It is a **local development** API: it has no authentication, and should never be exposed to a network.

Errors come back as `{"error": "…"}` — `422` for something the request got wrong (a failed rule, a bad name), `404` for an unknown endpoint, `500` for a crash.

## Site and templates

| | |
| --- | --- |
| `GET /api/health` | `{ ok, site }` |
| `GET /api/templates` | Every template: name, label, route, group. |
| `GET /api/templates/{name}` | A template's sections and layout sections with their schemas, every available section and block type, schema errors. |
| `PUT /api/templates/{name}` | Save a template's sections. |
| `PUT /api/layout` | Save `templates/layout.json`. |
| `GET /api/settings/schema` · `GET/PUT /api/settings` | Theme and plugin settings. |
| `GET/PUT /api/menus` | Navigation link lists. |

## Content

| | |
| --- | --- |
| `GET /api/content` · `GET /api/content-types` | Collections with their fields, icon, template and count. |
| `GET /api/content-types/presets` | The field presets. |
| `POST /api/content-types` | Create a content type: `{ name, label, fields, icon }`. |
| `PUT /api/content-types/{name}` | Update its label, icon and fields. |
| `GET /api/content/{collection}` | Its entries: slug, title, frontmatter, body. |
| `POST /api/content/{collection}` | Create an entry — refused if the slug exists. |
| `PUT /api/content/{collection}/{slug}` | Save an entry: `{ frontmatter, body }`. Published entries must pass their fields' rules. |
| `DELETE /api/content/{collection}/{slug}` | Delete it. |
| `POST /api/markdown` | Render `{ body }` to HTML. |

## Media

| | |
| --- | --- |
| `GET /api/media` | Every image and file: url, size, dimensions, kind, alt, where it is used. |
| `POST /api/media` | Upload `{ name, data }` (base64). |
| `PUT /api/media/alt` | Set `{ url, alt }`. |
| `DELETE /api/media` | Delete `{ url }` — only the site's own files. |

## Git and build

| | |
| --- | --- |
| `GET /api/status` | Branch, uncommitted files, whether there is a remote. |
| `GET /api/history` | Recent commits. |
| `POST /api/publish` | Commit `{ message }` — and push unless `push: false`. |
| `POST /api/discard` | Throw away uncommitted changes in the editor's paths. |
| `POST /api/build` | Run a build: pages, time, errors. |

## Plugins

| | |
| --- | --- |
| `GET /api/editor/plugins` | Dashboard bundles of enabled plugins. |
| `GET /api/editor/panels` | Content panels plugins registered. |
| `POST /api/editor/preview/{slug}` | A plugin's live preview resolver. |
