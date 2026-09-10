import { For, Show, createSignal } from 'solid-js';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import { ChevronRight, Plus, X } from '../ui/Icons';
import MediaLibrary, { mediaUrl } from '../MediaLibrary';

/** Several images, in order — an `image` field with `multiple`. */
export default function GalleryInput(props: { label?: string; info?: string; value: string[]; onValue: (value: string[]) => void }) {
  const [open, setOpen] = createSignal(false);

  const move = (from: number, to: number) => {
    const images = [...props.value];

    images.splice(to, 0, images.splice(from, 1)[0]);
    props.onValue(images);
  };

  return (
    <Field label={props.label} info={props.info}>
      <Show when={props.value.length}>
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          <For each={props.value}>
            {(url, index) => (
              <li class="group relative overflow-hidden rounded-lg border border-[#e1e3e5] bg-[#f6f6f7]">
                <img src={mediaUrl(url)} alt="" class="aspect-square w-full object-cover" />
                <div class="absolute inset-x-1 top-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    class="rounded bg-white/90 p-0.5 text-gray-600 shadow-sm hover:text-gray-900 disabled:invisible"
                    aria-label="Move earlier"
                    disabled={index() === 0}
                    onClick={() => move(index(), index() - 1)}
                  >
                    <ChevronRight size={12} class="rotate-180" />
                  </button>
                  <button type="button" class="rounded bg-white/90 p-0.5 text-gray-600 shadow-sm hover:text-red-600" aria-label="Remove image" onClick={() => props.onValue(props.value.filter((_, i) => i !== index()))}>
                    <X size={12} />
                  </button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <button type="button" class="sam-btn self-start" onClick={() => setOpen(true)}>
        <Plus size={12} /> Add image
      </button>
      <Modal open={open()} onOpenChange={setOpen} title="Add an image" wide flushBody>
        <MediaLibrary
          compact
          onChoose={(url) => {
            props.onValue([...props.value, url]);
            setOpen(false);
          }}
        />
      </Modal>
    </Field>
  );
}
