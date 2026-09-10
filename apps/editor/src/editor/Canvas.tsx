import { Show } from 'solid-js';
import { Copy, EyeOff, Trash2 } from 'lucide-solid';
import * as editor from '../store/editor';

/**
 * The preview.
 *
 * An iframe on `pillar dev`'s own render of the page under edit — not on
 * `dist/`. Rendering one route with the compiled-template cache warm is
 * milliseconds; serving the last build would show stale markup.
 */
export default function Canvas() {
  // Read the store memo directly rather than threading `<Show>`'s accessor into
  // the nested conditions below: an inner `<Show when={...}>` whose condition
  // reads the outer accessor hangs the page outright (caught live — the tab
  // stopped answering, no error, no console output). The memo is the same value
  // and costs nothing to read twice.
  const section = () => editor.activeSection();

  return (
    <div class="bg-[#f1f2f4] flex-grow flex justify-center items-center overflow-auto relative p-0">
      <div
        class="bg-white flex flex-col transition-all duration-300 overflow-hidden relative shadow-sm"
        classList={{
          'w-[375px] h-[667px] my-auto rounded-xl border border-[#e1e3e5]':
            editor.device() === 'mobile',
          'w-full h-full': editor.device() !== 'mobile',
        }}
      >
        <Show
          when={!editor.offline()}
          fallback={
            <div class="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-8">
              <p class="text-sm font-medium text-[#202223]">No preview server</p>
              <p class="text-xs text-gray-500 max-w-xs leading-relaxed">
                Run <code class="sam-mono">pillar dev</code> to render this page. The editor is
                running on demo data, so edits here are in memory only.
              </p>
            </div>
          }
        >
          <iframe
            ref={(frame) => editor.registerPreview(frame)}
            src={editor.previewUrl()}
            class="w-full h-full border-0 overflow-hidden"
            title="Preview"
          />
        </Show>
      </div>

      {/* Actions for the selected section, over the canvas */}
      <Show when={editor.tab() === 'sections' && section()}>
        <div class="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-[#e1e3e5] px-3.5 py-1.5 flex items-center gap-2.5 z-40">
          <span class="text-xs font-semibold text-gray-800 pr-1">
            {section()?.schema?.name ?? section()?.section_type}
          </span>

          <div class="w-px h-4 bg-gray-200" />

          <button
            type="button"
            onClick={() => editor.duplicateSection(section()!.section_id)}
            class="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Duplicate section"
          >
            <Copy size={13} />
          </button>

          <button
            type="button"
            onClick={() => editor.toggleSection(section()!.section_id)}
            class="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title={section()?.enabled ? 'Hide section' : 'Show section'}
          >
            <EyeOff size={13} />
          </button>

          <Show when={!section()?.is_layout}>
            <button
              type="button"
              onClick={() => editor.removeSection(section()!.section_id)}
              class="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
              title="Remove section"
            >
              <Trash2 size={13} />
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
