import { Show } from 'solid-js';
import { ImagePlus, Trash2 } from 'lucide-solid';
import Field from './Field';

interface ImagePickerProps {
  label?: string;
  info?: string;
  value?: string;
  onValue: (value: string | null) => void;
}

/**
 * Picks an asset by path.
 *
 * Uploading goes through `POST /api/media`, which writes into `assets/` and
 * returns the built URL — not wired here yet, so this is the path field plus a
 * preview, which is all a theme ever reads.
 */
export default function ImagePicker(props: ImagePickerProps) {
  return (
    <Field label={props.label} info={props.info}>
      <Show
        when={props.value}
        fallback={
          <button
            type="button"
            class="ed-media-empty w-full flex flex-col items-center justify-center gap-1.5 py-5 rounded-lg border border-dashed border-[#c9cccf] text-gray-500 hover:border-[#005bd3] hover:text-[#005bd3] transition-colors"
            onClick={() => {
              const path = window.prompt('Asset path', 'assets/');

              if (path) props.onValue(path);
            }}
          >
            <ImagePlus size={18} />
            <span class="text-[11px] font-medium">Choose an image</span>
          </button>
        }
      >
        <div class="ed-media-tile relative rounded-lg border border-[#e1e3e5] overflow-hidden bg-[#f6f6f7]">
          <img src={props.value} alt="" class="w-full h-24 object-cover" />
          <div class="ed-media-actions absolute top-1 right-1 flex gap-1">
            <button
              type="button"
              class="ed-media-action p-1 rounded-md bg-white/90 text-gray-600 hover:text-red-600 shadow-xs"
              title="Remove"
              onClick={() => props.onValue(null)}
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div class="px-2 py-1 text-[11px] font-mono text-gray-500 truncate bg-white border-t border-[#e1e3e5]">
            {props.value}
          </div>
        </div>
      </Show>
    </Field>
  );
}
