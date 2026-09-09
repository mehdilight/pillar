---
title: Writing a section
order: 2
---
A section is one `.liqx` file. Markup at the top, a `<schema>` block at the
bottom saying what can be edited:

```liqx
<div class="wrap hero">
  <h1>{section.settings.heading}</h1>
</div>
<schema>
{
  "name": "Hero",
  "settings": [
    { "id": "heading", "type": "text", "label": "Heading", "default": "Hello" }
  ]
}
</schema>
```

Drop it in `sections/`, and it appears in the dashboard's *Add section* list
with a text field labelled Heading. There is no registration step.

Values are cast to what their type promises before the template sees them, so
`{section.settings.padding + 8}` is arithmetic, not string concatenation, even
though JSON round-tripped it through a form.
