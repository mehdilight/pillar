import { Show, createSignal } from 'solid-js';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import { FileText } from '../ui/Icons';
import MediaLibrary from '../MediaLibrary';

/** A download from the media library — a PDF, an archive, a recording. */
export default function FilePicker(props: { label?: string; info?: string; value?: string | null; onValue: (value: string | null) => void }) {
  const [open, setOpen] = createSignal(false);
  const name = () => (props.value ?? '').split('/').pop() ?? '';

  return (
    <Field label={props.label} info={props.info}>
      <Show when={props.value}>
        <a
          href={props.value!}
          target="_blank"
          rel="noopener"
          class="flex min-w-0 items-center gap-2.5 rounded-lg border border-[#e1e3e5] bg-white px-3 py-2 hover:border-[#8c9196]"
        >
          <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#f1f2f4] text-gray-500">
            <FileText size={16} />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-xs font-medium text-[#303030]">{name()}</span>
            <span class="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">{name().split('.').pop()}</span>
          </span>
        </a>
      </Show>
      <div class="flex gap-2">
        <button type="button" class="sam-btn" onClick={() => setOpen(true)}>
          {props.value ? 'Change file' : 'Choose file'}
        </button>
        <Show when={props.value}>
          <button type="button" class="sam-btn" onClick={() => props.onValue(null)}>
            Remove
          </button>
        </Show>
      </div>
      <Modal open={open()} onOpenChange={setOpen} title="Choose a file" wide flushBody>
        <MediaLibrary
          compact
          kind="file"
          onChoose={(url) => {
            props.onValue(url);
            setOpen(false);
          }}
        />
      </Modal>
    </Field>
  );
}
