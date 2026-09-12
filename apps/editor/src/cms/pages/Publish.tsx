import { t, formatDate } from '../../i18n';
import { For, Show, createResource, createSignal } from 'solid-js';
import Page from '../ui/Page';
import { Badge, Button, Input, Textarea, Label, Loading, Notice, Postbox, SidebarLayout } from '../ui/ds';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import CustomSelect from '../../components/ui/CustomSelect';
import Modal from '../../components/ui/Modal';
import { showToast } from '../../components/ui/Toast';
import { api } from '../../api/client';
import { loadCollections } from '../../store/content';
import { refreshStatus, status } from '../../store/status';
import {
  ExternalLink,
  FileCode,
  GitBranch,
  Plus,
  RotateCcw,
  Trash2,
} from '../../components/ui/Icons';
import type { PullRequestResult } from '../../types';

/**
 * Publishing is a commit and push workflow with branch-based editorial stages.
 *
 * Everything the dashboard saved is a changed file in the working tree; this
 * page lists them, shows diffs, commits them, switches branches, and opens pull
 * requests for editorial review. Single-file discard and full-tree discard allow
 * targeted rollback.
 */
export default function Publish() {
  const [history, { refetch }] = createResource(() => api.history());
  const [message, setMessage] = createSignal('');
  const [pending, setPending] = createSignal(false);
  const [discardingAll, setDiscardingAll] = createSignal(false);
  const [fileToDiscard, setFileToDiscard] = createSignal<string | null>(null);
  const [push, setPush] = createSignal(true);

  // Branch management
  const [newBranchModal, setNewBranchModal] = createSignal(false);
  const [newBranchName, setNewBranchName] = createSignal('');
  const [branchPending, setBranchPending] = createSignal(false);
  const [branchToDelete, setBranchToDelete] = createSignal<string | null>(null);

  // Pull request & Merge
  const [prTitle, setPrTitle] = createSignal('');
  const [prBody, setPrBody] = createSignal('');
  const [prPending, setPrPending] = createSignal(false);
  const [prResult, setPrResult] = createSignal<PullRequestResult | null>(null);
  const [mergePending, setMergePending] = createSignal(false);

  // Diff viewer
  const [diffModal, setDiffModal] = createSignal(false);
  const [diffTitle, setDiffTitle] = createSignal('');
  const [diffContent, setDiffContent] = createSignal('');
  const [diffLoading, setDiffLoading] = createSignal(false);

  const files = () => status()?.files ?? [];
  const currentBranch = () => status()?.branch ?? 'main';
  const branches = () => status()?.branches ?? [];
  const isDefaultBranch = () => {
    const cur = currentBranch();
    return cur === 'main' || cur === 'master' || cur === 'no repository';
  };

  const publish = async () => {
    setPending(true);

    try {
      const result = await api.publish(message().trim() || t("Update site content"), push());

      showToast(result.message, 'success');
      setMessage('');
      await Promise.all([refreshStatus(), refetch()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Publish failed"), 'error');
    } finally {
      setPending(false);
    }
  };

  const discardAll = async () => {
    try {
      await api.discard();
      showToast(t("All changes discarded"), 'info');
      await Promise.all([refreshStatus(), loadCollections()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not discard"), 'error');
    }
  };

  const discardFile = async (path: string) => {
    try {
      await api.discard(path);
      showToast(t("Discarded changes to {{v0}}", { v0: path }), 'info');
      await Promise.all([refreshStatus(), loadCollections()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not discard file"), 'error');
    } finally {
      setFileToDiscard(null);
    }
  };

  const handleSwitchBranch = async (branch: string) => {
    if (branch === currentBranch()) return;
    setBranchPending(true);
    try {
      const result = await api.switchBranch(branch);
      showToast(result.message || t("Switched to {{v0}}", { v0: branch }), 'success');
      setPrResult(null);
      await Promise.all([refreshStatus(), refetch(), loadCollections()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not switch branch"), 'error');
    } finally {
      setBranchPending(false);
    }
  };

  const handleCreateBranch = async () => {
    const name = newBranchName().trim();
    if (!name) return;

    setBranchPending(true);
    try {
      const result = await api.createBranch(name);
      showToast(result.message || t("Created branch {{v0}}", { v0: name }), 'success');
      await api.switchBranch(name);
      setNewBranchName('');
      setNewBranchModal(false);
      setPrResult(null);
      await Promise.all([refreshStatus(), refetch(), loadCollections()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not create branch"), 'error');
    } finally {
      setBranchPending(false);
    }
  };

  const handleDeleteBranch = async (branch: string) => {
    setBranchPending(true);
    try {
      const result = await api.deleteBranch(branch);
      showToast(result.message || t("Deleted branch {{v0}}", { v0: branch }), 'info');
      await refreshStatus();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not delete branch"), 'error');
    } finally {
      setBranchPending(false);
      setBranchToDelete(null);
    }
  };

  const handleCreatePullRequest = async () => {
    const title = prTitle().trim() || `Draft: updates from ${currentBranch()}`;
    setPrPending(true);
    try {
      const result = await api.createPullRequest(title, prBody().trim());
      setPrResult(result);
      showToast(t("Pull request created successfully"), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not create pull request"), 'error');
    } finally {
      setPrPending(false);
    }
  };

  const handleMergeBranch = async () => {
    setMergePending(true);
    try {
      const result = await api.mergeBranch(currentBranch());
      showToast(result.message || t("Merged into default branch"), 'success');
      await Promise.all([refreshStatus(), refetch(), loadCollections()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Merge failed"), 'error');
    } finally {
      setMergePending(false);
    }
  };

  const showDiff = async (path?: string) => {
    setDiffTitle(path ? t("Diff: {{v0}}", { v0: path }) : t("Working Tree Diff"));
    setDiffLoading(true);
    setDiffModal(true);

    try {
      const result = await api.diff(path);
      setDiffContent(result.diff || '');
    } catch (error) {
      setDiffContent(error instanceof Error ? error.message : t("Failed to load diff"));
    } finally {
      setDiffLoading(false);
    }
  };

  return (
    <Page title={t("Publish & Branches")}>
      <SidebarLayout>
        <div>
          {/* Branch & Editorial Stage */}
          <Postbox
            title={
              <div class="flex items-center gap-2">
                <GitBranch size={16} class="text-text-muted" />
                <span>{t("Branch & Workflow")}</span>
                <Badge variant={isDefaultBranch() ? 'success' : 'info'}>
                  {isDefaultBranch() ? t("Production") : t("Draft Branch")}
                </Badge>
                <Show when={status()?.provider}>
                  <Badge variant="default" class="text-[10px] font-mono uppercase">
                    {status()?.provider}
                  </Badge>
                </Show>
              </div>
            }
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewBranchModal(true)}
                disabled={branchPending() || status()?.branch === 'no repository'}
              >
                <Plus size={13} />
                <span>{t("New branch")}</span>
              </Button>
            }
          >
            <div class="space-y-3">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <Label>{t("Active branch")}</Label>
                  <div class="min-w-[220px]">
                    <CustomSelect
                      value={currentBranch()}
                      disabled={branchPending() || branches().length === 0}
                      onChange={(val) => handleSwitchBranch(val)}
                      triggerClass="font-mono text-xs"
                      options={branches().map((b) => ({
                        value: b,
                        label: `${b}${b === currentBranch() ? ` (${t("current")})` : ''}${b === 'main' || b === 'master' ? ` (${t("default")})` : ''}`,
                      }))}
                    />
                  </div>
                </div>

                <Show when={!isDefaultBranch() && branches().length > 1}>
                  <div class="self-end sm:self-auto">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setBranchToDelete(currentBranch())}
                      disabled={branchPending()}
                    >
                      <Trash2 size={13} />
                      <span>{t("Delete branch")}</span>
                    </Button>
                  </div>
                </Show>
              </div>

              {/* Editorial Workflow Card (Pull Request / Review) */}
              <Show when={!isDefaultBranch()}>
                <div class="mt-4 rounded-ds border border-brand/25 bg-brand-tint/20 p-3.5">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <h3 class="text-xs font-semibold text-text">{t("Draft Editorial Workflow")}</h3>
                      <p class="mt-1 text-[11.5px] text-text-muted">
                        {t("Edits on")} <code class="font-mono font-medium text-text">{currentBranch()}</code> {t("are isolated from production. You can open a Pull Request for review or merge directly.")}
                      </p>
                    </div>
                  </div>

                  <Show
                    when={!prResult()}
                    fallback={
                      <div class="mt-3 rounded-ds border border-success/30 bg-success-tint p-3 text-xs">
                        <div class="flex items-center gap-1.5 font-medium text-success">
                          <span>{t("Pull Request #{{v0}} is open", { v0: prResult()?.number })}</span>
                        </div>
                        <Show when={prResult()?.url}>
                          <a
                            href={prResult()?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-brand hover:underline font-medium"
                          >
                            <span>{t("View Pull Request on GitHub")}</span>
                            <ExternalLink size={12} />
                          </a>
                        </Show>
                      </div>
                    }
                  >
                    <div class="mt-3 space-y-2">
                      <Input
                        placeholder={t("Pull request title (e.g. Autumn campaign updates)")}
                        value={prTitle()}
                        onInput={(e) => setPrTitle(e.currentTarget.value)}
                        class="max-w-none text-xs"
                      />
                      <Textarea
                        placeholder={t("Optional summary of changes for reviewers...")}
                        value={prBody()}
                        onInput={(e) => setPrBody(e.currentTarget.value)}
                        class="max-w-none text-xs min-h-16"
                      />
                      <div class="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleCreatePullRequest}
                          disabled={prPending()}
                        >
                          <GitBranch size={13} />
                          <span>{prPending() ? t("Creating PR…") : t("Open Pull Request")}</span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleMergeBranch}
                          disabled={mergePending() || files().length > 0}
                          title={files().length > 0 ? t("Commit or discard uncommitted changes before merging") : ''}
                        >
                          <span>{mergePending() ? t("Merging…") : t("Direct Merge to Default")}</span>
                        </Button>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </Postbox>

          {/* Changed Files */}
          <Postbox
            title={t("Changes{{v0}}", { v0: files().length ? ` (${files().length})` : '' })}
            flush
            actions={
              <Show when={files().length > 0}>
                <Button variant="secondary" size="sm" onClick={() => showDiff()}>
                  <FileCode size={13} />
                  <span>{t("View diff")}</span>
                </Button>
              </Show>
            }
          >
            <Show when={status()} fallback={<Loading />}>
              <Show when={files().length} fallback={<p class="p-4 text-xs text-text-faint">{t("Nothing to publish — everything is committed.")}</p>}>
                <ul>
                  <For each={files()}>
                    {(file) => (
                      <li class="flex items-center justify-between gap-3 px-4 py-2 border-b border-border last:border-0 hover:bg-surface-muted/50 transition-colors">
                        <div class="flex items-center gap-2.5 min-w-0 flex-1">
                          <Badge variant="warning">{file.startsWith('content/') ? t("Content") : file.startsWith('templates/') ? t("Page") : file.startsWith('assets/') ? t("Media") : t("Settings")}</Badge>
                          <code class="font-mono text-xs text-text-secondary truncate">{file}</code>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text hover:bg-surface-muted rounded transition-colors"
                            onClick={() => showDiff(file)}
                            title={t("View diff")}
                          >
                            <FileCode size={12} />
                            <span>{t("Diff")}</span>
                          </button>
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-danger/80 hover:text-danger hover:bg-danger-tint rounded transition-colors"
                            onClick={() => setFileToDiscard(file)}
                            title={t("Discard this file's changes")}
                          >
                            <RotateCcw size={12} />
                            <span>{t("Discard")}</span>
                          </button>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </Postbox>

          {/* History */}
          <Postbox title={t("History")} flush>
            <Show when={!history.loading} fallback={<Loading />}>
              <Show when={history()?.length} fallback={<p class="p-4 text-xs text-text-faint">{t("No commits yet.")}</p>}>
                <ul>
                  <For each={history()}>
                    {(entry) => (
                      <li class="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0">
                        <code class="font-mono text-[11px] text-text-faint mt-0.5">{entry.short}</code>
                        <div class="min-w-0 flex-1">
                          <p class="text-[13px] text-text truncate">{entry.message}</p>
                          <p class="text-[11.5px] text-text-muted">
                            {entry.author} · {formatDate(entry.date, { dateStyle: 'medium', timeStyle: 'short' })}
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

        {/* Sidebar Controls: Commit & Discard */}
        <div>
          <Postbox title={t("Commit")}>
            <Show when={status()?.branch === 'no repository'}>
              <Notice type="warning">{t("This site is not a git repository, so there is nothing to publish to.")}</Notice>
            </Show>
            <Label for="commit-message">{t("Message")}</Label>
            <Input
              id="commit-message"
              class="max-w-none"
              placeholder={t("Update site content")}
              value={message()}
              onInput={(event) => setMessage(event.currentTarget.value)}
            />
            <Show
              when={status()?.has_remote}
              fallback={
                <p class="mt-1.5 text-[11.5px] text-text-faint">
                  {t("Commits on")} <code class="font-mono">{status()?.branch ?? 'main'}</code>{t(". No remote is configured, so nothing is pushed.")}
                </p>
              }
            >
              <label class="mt-3 flex cursor-pointer items-start gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  class="mt-0.5 size-4 rounded border-border-strong text-brand focus:ring-brand"
                  checked={push()}
                  onChange={(event) => setPush(event.currentTarget.checked)}
                />
                <span>
                  {t("Push to remote after committing")}
                  <span class="mt-0.5 block text-[11.5px] text-text-faint">
                    {push()
                      ? t("Pushes to branch {{v0}}.", { v0: status()?.branch ?? 'main' })
                      : t("Committed locally on {{v0}} only.", { v0: status()?.branch ?? 'main' })}
                  </span>
                </span>
              </label>
            </Show>
            <div class="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={publish} disabled={pending() || files().length === 0}>
                {pending() ? t("Publishing…") : status()?.has_remote && !push() ? t("Commit") : t("Commit & publish")}
              </Button>
            </div>
          </Postbox>

          <Postbox title={t("Discard All")}>
            <p class="text-xs text-text-muted">
              {t("Throws away all uncommitted changes in templates, settings, content and media across the entire working tree.")}
            </p>
            <Button
              variant="danger"
              size="sm"
              class="mt-3"
              disabled={files().length === 0}
              onClick={() => setDiscardingAll(true)}
            >
              {t("Discard all changes")}
            </Button>
          </Postbox>
        </div>
      </SidebarLayout>

      {/* Discard All Dialog */}
      <ConfirmDialog
        open={discardingAll()}
        onOpenChange={setDiscardingAll}
        danger
        title={t("Discard all changes")}
        message={t("publish.discard", { count: files().length })}
        confirmLabel={t("Discard changes")}
        onConfirm={() => void discardAll()}
      />

      {/* Single File Discard Dialog */}
      <ConfirmDialog
        open={Boolean(fileToDiscard())}
        onOpenChange={(open) => !open && setFileToDiscard(null)}
        danger
        title={t("Discard file changes")}
        message={t("Discard all uncommitted changes to {{v0}}?", { v0: fileToDiscard() ?? '' })}
        confirmLabel={t("Discard file")}
        onConfirm={() => fileToDiscard() && void discardFile(fileToDiscard()!)}
      />

      {/* Delete Branch Dialog */}
      <ConfirmDialog
        open={Boolean(branchToDelete())}
        onOpenChange={(open) => !open && setBranchToDelete(null)}
        danger
        title={t("Delete branch")}
        message={t("Are you sure you want to delete branch {{v0}}? If it is not merged, its commits may be lost.", { v0: branchToDelete() ?? '' })}
        confirmLabel={t("Delete branch")}
        onConfirm={() => branchToDelete() && void handleDeleteBranch(branchToDelete()!)}
      />

      {/* New Branch Modal */}
      <Modal
        open={newBranchModal()}
        onOpenChange={setNewBranchModal}
        title={t("Create New Draft Branch")}
        footer={
          <div class="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setNewBranchModal(false)}>
              {t("Cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateBranch}
              disabled={branchPending() || !newBranchName().trim()}
            >
              {branchPending() ? t("Creating…") : t("Create & Switch")}
            </Button>
          </div>
        }
      >
        <div class="p-4 space-y-3">
          <p class="text-xs text-text-secondary">
            {t("Create an isolated draft branch to make content edits without affecting production.")}
          </p>
          <div>
            <Label for="new-branch-input">{t("Branch Name")}</Label>
            <Input
              id="new-branch-input"
              class="max-w-none text-xs font-mono"
              placeholder="draft/autumn-sale"
              value={newBranchName()}
              onInput={(e) => setNewBranchName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateBranch();
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Diff Modal */}
      <Modal
        open={diffModal()}
        onOpenChange={setDiffModal}
        title={diffTitle()}
        wide
        footer={
          <div class="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setDiffModal(false)}>
              {t("Close")}
            </Button>
          </div>
        }
      >
        <div class="p-4 max-h-[70vh] overflow-y-auto">
          <Show when={!diffLoading()} fallback={<Loading />}>
            <Show
              when={diffContent().trim().length > 0}
              fallback={
                <p class="text-xs text-text-faint">{t("No differences in this file or working tree.")}</p>
              }
            >
              <pre class="font-mono text-xs leading-5 bg-[#141414] text-gray-200 p-4 rounded-md overflow-x-auto whitespace-pre select-text">
                <For each={diffContent().split('\n')}>
                  {(line) => {
                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                    const isDel = line.startsWith('-') && !line.startsWith('---');
                    const isHeader = line.startsWith('@@');
                    const isMeta = line.startsWith('diff ') || line.startsWith('index ');

                    return (
                      <div
                        class="px-1 -mx-1"
                        classList={{
                          'bg-emerald-950/60 text-emerald-300': isAdd,
                          'bg-rose-950/60 text-rose-300': isDel,
                          'text-cyan-400 font-semibold': isHeader,
                          'text-gray-500 font-semibold': isMeta,
                        }}
                      >
                        {line || ' '}
                      </div>
                    );
                  }}
                </For>
              </pre>
            </Show>
          </Show>
        </div>
      </Modal>
    </Page>
  );
}
