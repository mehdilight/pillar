/**
 * The SEO plugin's dashboard bundle.
 *
 * Built as an IIFE against the dashboard's runtime (see
 * apps/editor/src/plugins/host.ts): Solid and `@pillar/editor` come from
 * `window.PillarHost`, never bundled. The build appends the
 * `PillarHost.define('seo', …)` call; this file only says what goes where.
 */
import type { ContentSidebarProps, ScopedHost, SettingsPanelProps } from '@pillar/editor';
import { api } from '@pillar/editor';
import SeoPanel, { type SeoPreview } from './SeoPanel';
import SeoSettingsPanel from './SeoSettingsPanel';
import './editor.css';

export function register(host: ScopedHost): void {
  // Replaces the generic form for this plugin's own settings panel: the
  // search-result preview and the everyday fields first, the patterns tucked
  // under Advanced.
  host.registerSlot('settings.panel', (props: SettingsPanelProps) => (
    <SeoSettingsPanel fields={props.fields} values={props.values} onChange={props.onChange} />
  ));

  // Beside an entry: its search snippet, overrides and content analysis,
  // written into the entry's `seo:` frontmatter.
  host.registerSlot('content.item.sidebar', (props: ContentSidebarProps) => (
    <SeoPanel
      collection={props.collection}
      slug={props.slug}
      frontmatter={props.frontmatter}
      body={props.body}
      onMeta={(seo) => props.setFrontmatter({ ...props.frontmatter, seo })}
      preview={(input) => api.preview<SeoPreview>('seo', input)}
    />
  ));
}
