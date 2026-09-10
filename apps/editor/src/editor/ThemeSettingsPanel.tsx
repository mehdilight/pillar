import { For, Show, createResource, createSignal } from 'solid-js';
import { ChevronDown } from '../components/ui/Icons';
import FormFields from '../components/fields/FormFields';
import { showToast } from '../components/ui/Toast';
import { api } from '../api/client';
import * as editor from '../store/editor';

/**
 * The theme's settings — `config/settings_schema.json`'s panels over
 * `config/settings_data.json` — beside the live preview they restyle.
 *
 * Only the theme's. A plugin's settings have no look to preview, so they live
 * in the CMS under Settings; this panel skips any panel a plugin contributed.
 */
export default function ThemeSettingsPanel() {
  const [schema] = createResource(api.settingsSchema);
  const [saved] = createResource(api.settings);
  const [values, setValues] = createSignal<Record<string, any> | null>(null);
  const [open, setOpen] = createSignal<string | null>(null);

  const current = () => values() ?? saved() ?? {};
  const panels = () => (schema() ?? []).filter((panel) => !panel.plugin);

  let timer: number | undefined;

  const change = (id: string, value: any) => {
    const next = { ...current(), [id]: value };
    const setting = panels()
      .flatMap((panel) => panel.settings)
      .find((entry) => entry.id === id);

    setValues(next);

    // Shown in the preview straight away; the save below re-renders it for real.
    if (setting?.css_var && value !== null && value !== undefined && value !== '') {
      editor.patchPreviewCss(setting.css_var, `${value}${setting.css_unit ?? ''}`);
    }

    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        await api.saveSettings(next);
        await editor.refreshStatus();
        editor.reloadPreview();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not save settings', 'error');
      }
    }, 400);
  };

  return (
    <aside class="w-[300px] flex flex-col h-full bg-white border-r border-[#e1e3e5] select-none overflow-y-auto">
      <div class="px-4 pt-3 pb-2 text-xs font-semibold text-gray-900">Theme settings</div>

      <Show when={schema()} fallback={<div class="px-4 py-6 text-xs text-gray-400">Loading settings…</div>}>
        <For each={panels()} fallback={<p class="px-4 text-xs text-gray-400">This theme declares no settings.</p>}>
          {(panel) => (
            <div class="border-b border-[#e1e3e5]">
              <button
                type="button"
                onClick={() => setOpen(open() === panel.name ? null : panel.name)}
                class="flex items-center justify-between w-full px-4 py-3 text-[13px] font-semibold text-[#202223] hover:bg-[#f6f6f7] transition-colors text-left cursor-pointer"
              >
                <span>{panel.name}</span>
                <ChevronDown size={15} class="transform transition-transform text-gray-500" classList={{ 'rotate-180': open() === panel.name }} />
              </button>

              <Show when={open() === panel.name}>
                <div class="px-3 pb-3">
                  <FormFields fields={panel.settings} values={current()} onChange={change} />
                </div>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </aside>
  );
}
