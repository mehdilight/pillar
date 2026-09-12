# Interface translations

The admin and visual editor use i18next with bundled English and French catalogs.
The header language selector updates the existing Solid UI without remounting
forms. `pillar.language` in local storage is shared across screens and tabs.
On first visit, the first supported browser language is used; English is the
fallback. The document's `lang` and displayed date/number formats follow it.

Import `t` from this directory and call it inside JSX, a memo, or an accessor.
For static toolbar/option descriptors, use a getter so a language change remains
reactive. Do not translate a value once at module initialization. When creating
editable data, copy the translated default into a plain property instead: a
language switch must never rewrite content or an unsaved draft.

Add messages to both `en.json` and `fr.json`. Most keys are the English source
text; plural messages use named keys with i18next's `_one` and `_other` suffixes.
Pass `{ count }` for plurals and named `{{variables}}` for interpolation. Keep
sentences whole where possible. Solid escapes rendered text; never insert
translations as raw HTML. Site content, theme-defined labels, paths, field IDs,
option values and API protocol tokens are not interface translations.

Plugins can import `createTranslator` and `language` from `@pillar/editor`:

```ts
const t = createTranslator('plugin.example', {
  en: { greeting: 'Hello {{name}}' },
  fr: { greeting: 'Bonjour {{name}}' },
});
// In JSX: {t('greeting', { name: props.name })}
```

Each plugin owns its namespace and catalogs, while the host owns i18next and the
reactive language. The SEO plugin uses this API, including its assessment text.
Content analysis language remains a separate content concern.

Run `npm test`, `npm run test:seo`, `npm run typecheck`, and `npm run build` from
`apps/editor`. The test command explicitly selects Solid's client runtime to
exercise live reactivity under Node instead of Solid's inert server signals.
