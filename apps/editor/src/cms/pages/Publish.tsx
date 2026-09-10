import { For, Show, createResource, createSignal } from 'solid-js';
import Page from '../ui/Page';
import { Badge, Button, Input, Label, Loading, Notice, Postbox, SidebarLayout } from '../ui/ds';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { api } from '../../api/client';
import { loadCollections } from '../../store/content';
import { refreshStatus, status } from '../../store/status';

/**
 * Publishing is a commit.
 *
 * Everything the dashboard saved is a changed file in the working tree; this
 * page lists them, commits them (and pushes, when a remote is configured), and
 * shows the history those commits make. Discard is `git checkout` over the
 * same paths — it is the one destructive button in the dashboard, so it says
 * exactly what it removes.
 */
export default function Publish() {
  const [history, { refetch }] = createResource(() => api.history());
  const [message, setMessage] = createSignal('');
  const [pending, setPending] = createSignal(false);
  const [discarding, setDiscarding] = createSignal(false);
  const [push, setPush] = createSignal(true);

  const files = () => status()?.files ?? [];

  const publish = async () => {
    setPending(true);

    try {
      const result = await api.publish(message().trim() || 'Update site content', push());

      showToast(result.message, 'success');
      setMessage('');
      await Promise.all([refreshStatus(), refetch()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Publish failed', 'error');
    } finally {
      setPending(false);
    }
  };

  const discard = async () => {
    try {
      await api.discard();
      showToast('Changes discarded', 'info');
      await Promise.all([refreshStatus(), loadCollections()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not discard', 'error');
    }
  };

  return (
    <Page title="Publish">
      <SidebarLayout>
        <div>
          <Postbox title={`Changes${files().length ? ` (${files().length})` : ''}`} flush>
            <Show when={status()} fallback={<Loading />}>
              <Show when={files().length} fallback={<p class="p-4 text-xs text-text-faint">Nothing to publish — everything is committed.</p>}>
                <ul>
                  <For each={files()}>
                    {(file) => (
                      <li class="flex items-center gap-3 px-4 py-2 border-b border-border last:border-0">
                        <Badge variant="warning">{file.startsWith('content/') ? 'Content' : file.startsWith('templates/') ? 'Page' : file.startsWith('assets/') ? 'Media' : 'Settings'}</Badge>
                        <code class="font-mono text-xs text-text-secondary truncate">{file}</code>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </Postbox>

          <Postbox title="History" flush>
            <Show when={!history.loading} fallback={<Loading />}>
              <Show when={history()?.length} fallback={<p class="p-4 text-xs text-text-faint">No commits yet.</p>}>
                <ul>
                  <For each={history()}>
                    {(entry) => (
                      <li class="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0">
                        <code class="font-mono text-[11px] text-text-faint mt-0.5">{entry.short}</code>
                        <div class="min-w-0 flex-1">
                          <p class="text-[13px] text-text truncate">{entry.message}</p>
                          <p class="text-[11.5px] text-text-muted">
                            {entry.author} · {new Date(entry.date).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </Postbox>
        </div>

        <div>
          <Postbox title="Commit">
            <Show when={status()?.branch === 'no repository'}>
              <Notice type="warning">This site is not a git repository, so there is nothing to publish to.</Notice>
            </Show>
            <Label for="commit-message">Message</Label>
            <Input
              id="commit-message"
              class="max-w-none"
              placeholder="Update site content"
              value={message()}
              onInput={(event) => setMessage(event.currentTarget.value)}
            />
            <Show
              when={status()?.has_remote}
              fallback={
                <p class="mt-1.5 text-[11.5px] text-text-faint">
                  Commits on <code class="font-mono">{status()?.branch ?? 'main'}</code>. No remote is configured, so nothing is pushed.
                </p>
              }
            >
              <label class="mt-3 flex cursor-pointer items-start gap-2 text-xs text-text-secondary">
                <input type="checkbox" class="mt-0.5 size-4 rounded border-border-strong text-brand focus:ring-brand" checked={push()} onChange={(event) => setPush(event.currentTarget.checked)} />
                <span>
                  Push to the remote after committing
                  <span class="mt-0.5 block text-[11.5px] text-text-faint">
                    {push() ? 'Your host deploys from what is pushed.' : `Committed on ${status()?.branch ?? 'main'} only — push later with git, or publish again.`}
                  </span>
                </span>
              </label>
            </Show>
            <div class="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={publish} disabled={pending() || files().length === 0}>
                {pending() ? 'Publishing…' : status()?.has_remote && !push() ? 'Commit' : 'Commit & publish'}
              </Button>
            </div>
          </Postbox>

          <Postbox title="Discard">
            <p class="text-xs text-text-muted">Throws away every uncommitted change in templates, settings, content and media — including files added since the last commit.</p>
            <Button variant="danger" size="sm" class="mt-3" disabled={files().length === 0} onClick={() => setDiscarding(true)}>
              Discard changes
            </Button>
          </Postbox>
        </div>
      </SidebarLayout>

      <ConfirmDialog
        open={discarding()}
        onOpenChange={setDiscarding}
        danger
        title="Discard changes"
        message={`${files().length} uncommitted file${files().length === 1 ? '' : 's'} go back to the last commit. Files added since then — a new entry, an uploaded image — are deleted. This cannot be undone.`}
        confirmLabel="Discard changes"
        onConfirm={() => void discard()}
      />
    </Page>
  );
}
