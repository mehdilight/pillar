import { For, Show, createEffect, createSignal, on } from 'solid-js';
import { ChevronDown, Trash2, X } from '../components/ui/Icons';
import { SectionIcon } from '../components/ui/SectionIcon';
import SettingInput from '../components/SettingInput';
import * as editor from '../store/editor';
import type { PageSection } from '../types';

/**
 * The settings form for one section.
 *
 * Values are held locally and committed on a debounce: a colour picker fires on
 * every drag, and a save per frame would rewrite the template JSON — and reload
 * the preview — dozens of times a second.
 */
export default function SettingsPanel(props: { section: PageSection }) {
  const [local, setLocal] = createSignal<Record<string, any>>({});
  const [cssOpen, setCssOpen] = createSignal(false);
  const [css, setCss] = createSignal('');

  let timer: number | undefined;

  // A different section is a different form: reset, don't carry values across.
  createEffect(
    on(
      () => props.section.section_id,
      () => {
        setLocal({ ...(props.section.settings ?? {}) });
        setCss(props.section.custom_css ?? '');
        setCssOpen(Boolean(props.section.custom_css));
      }
    )
  );

  const commit = (settings: Record<string, any>) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(
      () => editor.updateSection(props.section.section_id, { settings }),
      300
    );
  };

  const change = (id: string, value: any) => {
    const next = { ...local(), [id]: value };

    setLocal(next);
    commit(next);
  };

  const settings = () => props.section.schema?.settings ?? [];

  return (
    <div class="flex flex-col h-full bg-white select-none">
      <div class="flex items-center justify-between px-3 py-2.5 border-b border-[#e1e3e5] shrink-0 bg-white">
        <div class="flex items-center gap-2 font-semibold text-xs text-gray-900 truncate">
          <SectionIcon size={14} class="text-gray-700 shrink-0" />
          <span class="truncate">{props.section.schema?.name ?? props.section.section_type}</span>
        </div>
        <button
          type="button"
          onClick={editor.closeSettings}
          class="p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-[#f1f2f4] transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto min-h-0">
        <div class="px-3 py-3 space-y-3">
          <Show
            when={settings().length > 0}
            fallback={
              <div class="text-center py-6 text-xs text-gray-400">
                This section declares no settings.
              </div>
            }
          >
            <For each={settings()}>
              {(setting) => (
                <SettingInput
                  setting={setting}
                  value={local()[setting.id]}
                  onChange={(value) => change(setting.id, value)}
                />
              )}
            </For>
          </Show>
        </div>

        <div class="border-t border-[#e1e3e5] bg-white">
          <div class="border-b border-[#e1e3e5]">
            <button
              type="button"
              onClick={() => setCssOpen(!cssOpen())}
              class="flex items-center justify-between w-full px-4 py-3 text-[13px] font-semibold text-[#202223] hover:bg-[#f6f6f7] transition-colors text-left cursor-pointer"
            >
              <span>Custom CSS</span>
              <ChevronDown
                size={15}
                class="transform transition-transform text-gray-500"
                classList={{ 'rotate-180': cssOpen() }}
              />
            </button>

            <Show when={cssOpen()}>
              <div class="px-4 pb-4 pt-1 flex flex-col gap-2 bg-[#f9fafb]">
                <textarea
                  class="w-full text-xs font-mono p-2.5 border border-[#c9cccf] rounded-lg bg-white resize-y outline-none focus:border-[#005bd3] focus:ring-0"
                  style={{ 'min-height': '120px', 'white-space': 'pre', 'tab-size': 2 }}
                  placeholder={'/* Scoped to this section */\n& {\n  padding: 20px 0;\n}'}
                  spellcheck={false}
                  value={css()}
                  onInput={(event) => {
                    setCss(event.currentTarget.value);
                    window.clearTimeout(timer);
                    timer = window.setTimeout(
                      () =>
                        editor.updateSection(props.section.section_id, {
                          custom_css: event.currentTarget.value,
                        }),
                      400
                    );
                  }}
                />
                <span class="text-[11px] text-gray-500 leading-tight">
                  <code class="sam-mono">&amp;</code> is this section's wrapper. Written into the
                  page's template JSON, not the theme source.
                </span>
              </div>
            </Show>
          </div>

          <Show when={!props.section.is_layout}>
            <div class="p-4">
              <button
                type="button"
                onClick={() => editor.removeSection(props.section.section_id)}
                class="flex items-center justify-center gap-2.5 w-full py-2.5 px-3 text-[13px] font-semibold text-[#8a1200] hover:text-[#b91c1c] hover:bg-red-50/50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 size={16} class="text-[#8a1200]" />
                <span>Remove section</span>
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
