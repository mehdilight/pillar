---
title: Validation
summary: What pillar check looks for — in schemas, templates and content — and how problems are reported.
section: reference
order: 73
---
```bash
pillar check --site my-site
```

```text
error   templates/index.json   Section "promo" is type "banner", which no layer provides.
warning content/posts/hello.md  "related" points to posts/gone, which does not exist.

1 error(s), 1 warning(s)
```

Errors fail the command; warnings are printed and pass. Run it in CI before building.

## Schemas

- Every section's and block's `<schema>` parses: valid JSON, known field types, ids that are lowercase and unique among their siblings, options where a type needs them, sub-fields for groups and repeaters, at most three levels of nesting.
- Every `visible_if` rule names a real sibling field and a known operator.
- Every `schemas/<collection>.json` parses the same way.

## Templates

- Every template's JSON parses.
- Every section instance has a type, and some layer provides it — the most common real mistake: a template naming a section that was renamed.
- A section used on a template its `enabled_on` excludes (warning).
- A section storing a setting its schema does not declare (warning) — kept, not deleted, so renaming a setting never destroys data silently.
- More blocks than `max_blocks` allows.
- A layout exists in some layer.

## Content

For every entry of a collection with a schema, into groups and repeater rows (`faq[1].answer`):

- values of the wrong type — a string where a boolean belongs;
- values outside a field's options;
- [rules](/docs/rules-and-conditions/): required fields, character limits, email addresses, too many rows or entries, disallowed file types — errors for published entries, warnings for drafts;
- [relationships](/docs/relationships/) pointing at entries that do not exist (warning).

The dashboard and the server apply the same rules when an entry is saved, so problems rarely reach `pillar check` — but a hand-edited file can.
