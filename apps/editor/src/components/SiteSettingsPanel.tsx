import { For, Show, createResource, createSignal } from 'solid-js';
import { ChevronDown } from 'lucide-solid';
import SettingInput from './SettingInput';
import { api } from '../api/client';
import * as editor from '../store/editor';

/**
 * `config/settings_schema.json` on the left, `config/settings_data.json`
 * underneath. Site-wide values every template can read as `settings.*`.
 */
export default function SiteSettingsPanel() {
  const [schema] = createResource(api.settingsSchema);
  const [saved] = createResource(api.settings);
  const [values, setValues] = createSignal<Record<string, any> | null>(null);
  const [open, setOpen] = createSignal<string | null>(null);

  const current = () => values() ?? saved() ?? {};

  let timer: number | undefined;

  const change = (id: string, value: any) => {
    const next = { ...current(), [id]: value };

    setValues(next);
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      await api.saveSettings(next);
      await editor.refreshStatus();
      editor.reloadPreview();
    }, 400);
  };

  return (
    <aside class="w-[300px] flex flex-col h-full bg-white border-r border-[#e1e3e5] select-none overflow-y-auto">
      <div class="px-4 pt-3 pb-2 text-xs font-semibold text-gray-900">Site settings</div>

      <Show when={schema()} fallback={<PanelSkeleton />}>
        <For each={schema()}>
          {(panel) => (
            <div class="border-b border-[#e1e3e5]">
              <button
                type="button"
                onClick={() => setOpen(open() === panel.name ? null : panel.name)}
                class="flex items-center justify-between w-full px-4 py-3 text-[13px] font-semibold text-[#202223] hover:bg-[#f6f6f7] transition-colors text-left cursor-pointer"
              >
                <span>{panel.name}</span>
                <ChevronDown
                  size={15}
                  class="transform transition-transform text-gray-500"
                  classList={{ 'rotate-180': open() === panel.name }}
                />
              </button>

              <Show when={open() === panel.name}>
                <div class="px-3 pb-3">
                  <For each={panel.settings}>
                    {(setting) => (
                      <SettingInput
                        setting={setting}
                        value={current()[setting.id]}
                        onChange={(value) => change(setting.id, value)}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </aside>
  );
}

function PanelSkeleton() {
  return (
    <div class="px-4 py-6 text-xs text-gray-400">Loading settings…</div>
  );
}
