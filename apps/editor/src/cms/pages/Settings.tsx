import { For, Show, createResource, createSignal } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { A } from '@solidjs/router';
import Page from '../ui/Page';
import { Postbox, SidebarLayout, buttonClass } from '../ui/ds';
import SettingInput from '../../components/SettingInput';
import { showToast } from '../../components/ui/Toast';
import { api, editorConfig } from '../../api/client';
import { refreshStatus } from '../../store/status';
import { slotsFor } from '../../plugins/host';

/**
 * Site settings that are not the theme's.
 *
 * The theme's own settings — colours, layout, the name in its header — belong
 * beside a live preview, so they live in the visual editor. What is left here
 * is what has no look: the settings each enabled plugin contributes, SEO's
 * among them, and the facts `site.json` declares.
 */
export default function Settings() {
  const [schema] = createResource(api.settingsSchema);
  const [saved, { refetch }] = createResource(api.settings);
  const [values, setValues] = createSignal<Record<string, any> | null>(null);

  const current = () => values() ?? saved() ?? {};
  const pluginPanels = () => (schema() ?? []).filter((panel) => panel.plugin);

  let timer: number | undefined;

  const change = (id: string, value: unknown) => {
    const next = { ...current(), [id]: value };

    setValues(next);
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        // The whole map, as the editor sends it: the server splits plugin
        // keys out into config/plugins/<slug>.json.
        await api.saveSettings(next);
        await refreshStatus();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not save settings', 'error');
        setValues(null);
        void refetch();
      }
    }, 400);
  };

  /** A plugin's own panel, when its bundle registered one for its settings. */
  const custom = (plugin: string | undefined) => (plugin === undefined ? undefined : slotsFor('settings.panel', plugin)[0]);

  return (
    <Page title="Settings">
      <SidebarLayout>
        <div>
          <Show when={pluginPanels().length} fallback={<Postbox title="Plugins"><p class="text-xs text-text-faint">No enabled plugin has settings.</p></Postbox>}>
            <For each={pluginPanels()}>
              {(panel) => (
                <Postbox title={panel.name}>
                  <Show
                    when={custom(panel.plugin)}
                    fallback={
                      <For each={panel.settings}>
                        {(setting) => (
                          <SettingInput setting={setting} value={current()[setting.id]} onChange={(value) => change(setting.id, value)} />
                        )}
                      </For>
                    }
                  >
                    {/* The element the plugin's stylesheet is scoped to. */}
                    <div data-pillar-plugin={panel.plugin}>
                      <Dynamic component={custom(panel.plugin)!.component} fields={panel.settings} values={current()} onChange={change} />
                    </div>
                  </Show>
                </Postbox>
              )}
            </For>
          </Show>
        </div>

        <div>
          <Postbox title="Site">
            <dl class="space-y-3 text-xs">
              <div>
                <dt class="text-text-muted">Name</dt>
                <dd class="mt-0.5 text-[13px] text-text">{editorConfig.siteName}</dd>
              </div>
              <div>
                <dt class="text-text-muted">Declared in</dt>
                <dd class="mt-0.5 font-mono text-text-secondary">site.json</dd>
              </div>
            </dl>
            <p class="mt-3 text-[11.5px] text-text-faint">Base URL, plugins and deploy target are edited in site.json — they change what the build does, not how the site looks.</p>
          </Postbox>

          <Postbox title="Theme">
            <p class="text-xs text-text-muted">Colours, layout and the site's name in its header are theme settings, edited beside a live preview.</p>
            <A href="/editor" class={`${buttonClass('secondary', 'sm')} mt-3`}>
              Open the theme editor
            </A>
          </Postbox>
        </div>
      </SidebarLayout>
    </Page>
  );
}
