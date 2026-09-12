import { t } from '../../i18n';
import { Show, createSignal } from 'solid-js';
import Field, { controlClass } from './Field';
import Modal from './Modal';
import MediaLibrary, { mediaUrl } from '../MediaLibrary';

/** Every image field selects from the same site media library. */
export default function ImagePicker(props: { label?: string; info?: string; value?: string; onValue: (value: string | null) => void }) {
  const [open, setOpen] = createSignal(false);
  const [address, setAddress] = createSignal('');
  return <Field label={props.label} info={props.info}>
    <Show when={props.value}><img src={mediaUrl(props.value!)} alt="Selected image" class="w-full h-28 object-cover rounded-lg border border-[#e1e3e5]" /></Show>
    <div class="flex gap-2">
      <button type="button" class="sam-btn" onClick={() => setOpen(true)}>{props.value ? t("Change image") : t("Choose image")}</button>
      <Show when={props.value}><button type="button" class="sam-btn" onClick={() => props.onValue(null)}>{t("Remove")}</button></Show>
    </div>
    <details class="mt-1"><summary class="text-[11px] text-gray-500 cursor-pointer">{t("Use an image link")}</summary>
      <input type="url" aria-label={t("Image link")} class={`${controlClass} mt-2`} placeholder="https://…" value={address()} onInput={(e) => setAddress(e.currentTarget.value)} />
      <button type="button" class="sam-btn mt-2" disabled={!/^https?:\/\//i.test(address())} onClick={() => props.onValue(address().trim())}>{t("Use image")}</button>
    </details>
    <Modal open={open()} onOpenChange={setOpen} title={t("Choose an image")} wide flushBody>
      <MediaLibrary compact onChoose={(url) => { props.onValue(url); setOpen(false); }} />
    </Modal>
  </Field>;
}
