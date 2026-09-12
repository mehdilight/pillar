import { t } from '../../i18n';
import { Show, createSignal } from 'solid-js';
import Field, { controlClass } from '../ui/Field';
import Modal from '../ui/Modal';
import MediaLibrary from '../MediaLibrary';

/** Addresses a theme's `video_tag` embeds rather than plays as a file. */
export const embedOf = (url: string): string | null => {
  const youtube = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url);

  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;

  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);

  return vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
};

/**
 * A video: an MP4 or WebM from the media library, or a YouTube or Vimeo link.
 * Stored as the address either way; `video_tag` turns it into a player.
 */
export default function VideoPicker(props: { label?: string; info?: string; value?: string | null; onValue: (value: string | null) => void }) {
  const [open, setOpen] = createSignal(false);
  const [address, setAddress] = createSignal('');

  const valid = () => /^https:\/\//i.test(address().trim());

  let linkBox!: HTMLDetailsElement;

  return (
    <Field label={props.label} info={props.info ?? t("An MP4 or WebM from the media library, or a YouTube or Vimeo link.")}>
      <Show when={props.value}>
        <Show
          when={embedOf(props.value!)}
          fallback={<video src={props.value!} controls preload="metadata" class="w-full max-h-40 rounded-lg border border-[#e1e3e5] bg-black" />}
        >
          <a href={props.value!} target="_blank" rel="noopener" class="block truncate rounded-lg border border-[#e1e3e5] bg-white px-3 py-2 text-xs text-[#005bd3] hover:underline">
            {props.value}
          </a>
        </Show>
      </Show>
      <div class="flex gap-2">
        <button type="button" class="sam-btn" onClick={() => setOpen(true)}>
          {props.value ? t("Change video") : t("Choose video")}
        </button>
        <Show when={props.value}>
          <button type="button" class="sam-btn" onClick={() => props.onValue(null)}>
            {t("Remove")} </button>
        </Show>
      </div>
      <details ref={linkBox} class="mt-1">
        <summary class="cursor-pointer text-[11px] text-gray-500">{t("Use a YouTube or Vimeo link")}</summary>
        <input
          type="url"
          aria-label={t("Video link")}
          class={`${controlClass} mt-2`}
          placeholder="https://www.youtube.com/watch?v=…"
          value={address()}
          onInput={(event) => setAddress(event.currentTarget.value)}
        />
        <button
          type="button"
          class="sam-btn mt-2"
          disabled={!valid()}
          onClick={() => {
            props.onValue(address().trim());
            setAddress('');
            linkBox.open = false;
          }}
        >
          {t("Use link")} </button>
      </details>
      <Modal open={open()} onOpenChange={setOpen} title={t("Choose a video")} wide flushBody>
        <MediaLibrary
          compact
          kind="file"
          extensions={['mp4', 'webm']}
          onChoose={(url) => {
            props.onValue(url);
            setOpen(false);
          }}
        />
      </Modal>
    </Field>
  );
}
