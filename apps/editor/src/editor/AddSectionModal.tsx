import { t } from '../i18n';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { Search } from '../components/ui/Icons';
import Modal from '../components/ui/Modal';
import { SectionIcon } from '../components/ui/SectionIcon';
import * as editor from '../store/editor';

/**
 * The section picker.
 *
 * `enabled_on` is the theme author's word on where a section belongs; a section
 * that names templates and does not name this one is not offered here.
 */
export default function AddSectionModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = createSignal('');

  const candidates = createMemo(() => {
    const term = query().trim().toLowerCase();
    const template = editor.templateName();

    return editor
      .availableSections()
      .filter((section) => !section.enabled_on?.length || section.enabled_on.includes(template))
      .filter(
        (section) =>
          !term ||
          section.name.toLowerCase().includes(term) ||
          section.type.includes(term) ||
          (section.description ?? '').toLowerCase().includes(term)
      );
  });

  return (
    <Modal open={props.open} onOpenChange={props.onOpenChange} title={t("Add a section")} flushBody>
      <div class="ed-picker-search px-3 py-2.5 border-b border-[#e1e3e5] sticky top-0 bg-white z-10">
        <div class="relative flex items-center">
          <Search size={14} class="absolute left-2.5 text-gray-400 pointer-events-none" />
          <input
            type="search"
            autofocus
            class="w-full h-9 bg-white border border-[#c9cccf] rounded-lg pl-8 pr-3 text-[13px] text-[#202223] placeholder-gray-400 outline-none focus:border-[#005bd3] focus:ring-1 focus:ring-[#005bd3]"
            placeholder={t("Search sections")}
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
      </div>

      <div class="ed-picker-list py-1">
        <Show
          when={candidates().length}
          fallback={
            <div class="ed-picker-empty px-4 py-8 text-center text-xs text-gray-400">
              {t("No section matches — or none of this theme's sections are enabled on this template.")} </div>
          }
        >
          <For each={candidates()}>
            {(section) => (
              <button
                type="button"
                class="ed-pick-row flex items-start gap-3 w-full px-4 py-2.5 text-left hover:bg-[#f1f2f4] transition-colors"
                onClick={() => {
                  editor.addSection(section.type);
                  props.onOpenChange(false);
                  setQuery('');
                }}
              >
                <span class="ed-pick-thumb mt-0.5 w-8 h-8 rounded-md bg-[#f6f6f7] border border-[#e1e3e5] flex items-center justify-center text-gray-500 shrink-0">
                  <SectionIcon size={15} />
                </span>
                <span class="flex flex-col min-w-0">
                  <span class="ed-pick-title text-[13px] font-medium text-[#202223]">
                    {section.name}
                  </span>
                  <Show when={section.description}>
                    <span class="ed-pick-sub text-[11px] text-gray-500 truncate">
                      {section.description}
                    </span>
                  </Show>
                </span>
                <span class="ml-auto sam-mono text-[11px] text-gray-400 shrink-0">
                  {section.type}
                </span>
              </button>
            )}
          </For>
        </Show>
      </div>
    </Modal>
  );
}
