import { t } from '../i18n';
import { For, Show, createSignal } from 'solid-js';
import Modal from '../components/ui/Modal';
import { showToast } from '../components/ui/Toast';
import * as editor from '../store/editor';

/**
 * Publishing is a commit.
 *
 * With a remote configured it pushes too, and the deploy runs wherever the
 * site's adapter points — so this dialog is the last human step before the
 * public site changes.
 */
export default function PublishDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = createSignal('');
  const [pending, setPending] = createSignal(false);

  const files = () => editor.status()?.files ?? [];
  const [push, setPush] = createSignal(true);

  const run = async () => {
    setPending(true);

    try {
      const result = await editor.publish(message().trim() || t("Update site content"), push());

      showToast(result.message, 'success');
      props.onOpenChange(false);
      setMessage('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Publish failed"), 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t("Publish changes")}
      footer={
        <>
          <button type="button" class="sam-btn" onClick={() => props.onOpenChange(false)}>
            {t("Cancel")} </button>
          <button
            type="button"
            class="sam-btn primary"
            disabled={pending() || files().length === 0}
            onClick={run}
          >
            {pending() ? t("Publishing…") : editor.status()?.has_remote && !push() ? t("Commit") : t("Commit & publish")}
          </button>
        </>
      }
    >
      <Show
        when={files().length}
        fallback={<p class="text-[13px] text-gray-500">{t("Nothing to publish — the tree is clean.")}</p>}
      >
        <p class="text-[13px] text-[#303030]">
          {t("publish.files", { count: files().length, branch: editor.status()?.branch })}
          <Show when={editor.status()?.has_remote && push()}> {t("and pushed.")}</Show>
        </p>

        <Show when={editor.status()?.has_remote}>
          <label class="flex cursor-pointer items-center gap-2 text-[12px] text-[#303030]">
            <input type="checkbox" class="size-4 rounded border-[#c9cccf]" checked={push()} onChange={(event) => setPush(event.currentTarget.checked)} />
            {t("Push to the remote after committing")} </label>
        </Show>

        <ul class="rounded-lg border border-[#e1e3e5] bg-[#f6f6f7] divide-y divide-[#e1e3e5] max-h-48 overflow-y-auto">
          <For each={files()}>
            {(file) => <li class="px-3 py-1.5 sam-mono text-[11px] text-gray-600">{file}</li>}
          </For>
        </ul>

        <label class="sam-label" for="publish-message">
          {t("Commit message")} </label>
        <input
          id="publish-message"
          type="text"
          class="sam-input"
          placeholder={t("Update site content")}
          value={message()}
          onInput={(event) => setMessage(event.currentTarget.value)}
        />
      </Show>
    </Modal>
  );
}
