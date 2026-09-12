import { t } from '../../i18n';
import { For, Show, createEffect, createResource, createSignal } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { A } from '@solidjs/router';
import Page from '../ui/Page';
import { Badge, Button, Input, Label, Loading, Notice, Postbox, SidebarLayout, buttonClass } from '../ui/ds';
import FormFields from '../../components/fields/FormFields';
import CustomSelect from '../../components/ui/CustomSelect';
import { GitBranch, Check } from '../../components/ui/Icons';
import { showToast } from '../../components/ui/Toast';
import { api, editorConfig } from '../../api/client';
import { refreshStatus } from '../../store/status';
import { slotsFor } from '../../plugins/host';
import type { GitConfig } from '../../types';

/**
 * Site settings that are not the theme's.
 *
 * The theme's own settings — colours, layout, the name in its header — belong
 * beside a live preview, so they live in the visual editor. What is left here
 * is what has no look: the settings each enabled plugin contributes, SEO's
 * among them, the facts `site.json` declares, and Git provider / author setup.
 */
export default function Settings() {
  const [schema] = createResource(api.settingsSchema);
  const [saved, { refetch }] = createResource(api.settings);
  const [values, setValues] = createSignal<Record<string, any> | null>(null);

  // Git configuration resource & state
  const [gitData, { refetch: refetchGit }] = createResource(api.gitConfig);
  const [gitProvider, setGitProvider] = createSignal<'auto' | 'local' | 'github'>('auto');
  const [authorName, setAuthorName] = createSignal('');
  const [authorEmail, setAuthorEmail] = createSignal('');
  const [githubRepo, setGithubRepo] = createSignal('');
  const [githubBranch, setGithubBranch] = createSignal('main');
  const [githubToken, setGithubToken] = createSignal('');
  const [gitSaving, setGitSaving] = createSignal(false);

  createEffect(() => {
    const cfg = gitData();
    if (cfg) {
      setGitProvider(cfg.provider);
      setAuthorName(cfg.author_name || '');
      setAuthorEmail(cfg.author_email || '');
      setGithubRepo(cfg.github?.repo || '');
      setGithubBranch(cfg.github?.branch || 'main');
    }
  });

  const current = () => values() ?? saved() ?? {};
  const pluginPanels = () => (schema() ?? []).filter((panel) => panel.plugin);

  let timer: number | undefined;

  const change = (id: string, value: unknown) => {
    const next = { ...current(), [id]: value };

    setValues(next);
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        // The whole map, as the editor sends it: the server splits plugin
        // keys out into config/plugins/<slug>.json.
        await api.saveSettings(next);
        await refreshStatus();
      } catch (error) {
        showToast(error instanceof Error ? error.message : t("Could not save settings"), 'error');
        setValues(null);
        void refetch();
      }
    }, 400);
  };

  const handleSaveGit = async (e: Event) => {
    e.preventDefault();
    setGitSaving(true);

    try {
      const payload: Parameters<typeof api.saveGitConfig>[0] = {
        provider: gitProvider(),
        author_name: authorName().trim(),
        author_email: authorEmail().trim(),
        github: {
          repo: githubRepo().trim(),
          branch: githubBranch().trim() || 'main',
        },
      };

      if (githubToken().trim()) {
        payload.github!.token = githubToken().trim();
      }

      const result = await api.saveGitConfig(payload);
      showToast(result.message || t("Git settings saved"), 'success');
      setGithubToken('');
      await Promise.all([refetchGit(), refreshStatus()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not save Git settings"), 'error');
    } finally {
      setGitSaving(false);
    }
  };

  /** A plugin's own panel, when its bundle registered one for its settings. */
  const custom = (plugin: string | undefined) => (plugin === undefined ? undefined : slotsFor('settings.panel', plugin)[0]);

  return (
    <Page title={t("Settings")}>
      <SidebarLayout>
        <div>
          {/* Git & Version Control Configuration */}
          <Postbox
            title={
              <div class="flex items-center gap-2">
                <GitBranch size={16} class="text-text-muted" />
                <span>{t("Git & Version Control")}</span>
                <Show when={gitData()}>
                  {(cfg) => (
                    <Badge variant={cfg().active_provider === 'github' ? 'info' : 'success'} class="text-[10px] font-mono uppercase">
                      {cfg().active_provider === 'github' ? t("GitHub API Mode") : t("Local Git CLI")}
                    </Badge>
                  )}
                </Show>
              </div>
            }
          >
            <Show when={!gitData.loading} fallback={<Loading />}>
              <form onSubmit={handleSaveGit} class="space-y-4">
                <p class="text-xs text-text-muted">
                  {t("Configure whether Pillar uses your local Git CLI or remote GitHub APIs for headless hosting environments.")}
                </p>

                <div class="max-w-[420px]">
                  <Label for="git-provider">{t("Provider Mode")}</Label>
                  <CustomSelect<'auto' | 'local' | 'github'>
                    id="git-provider"
                    value={gitProvider()}
                    onChange={(val) => setGitProvider(val)}
                    options={[
                      { value: 'auto', label: t("Auto-detect (Local Git if present, otherwise GitHub API)") },
                      { value: 'local', label: t("Local Git CLI (direct repository working tree)") },
                      { value: 'github', label: t("GitHub API (Headless / Remote mode without local Git)") },
                    ]}
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[420px]">
                  <div>
                    <Label for="author-name">{t("Commit Author Name")}</Label>
                    <Input
                      id="author-name"
                      placeholder={t("Editorial Team")}
                      value={authorName()}
                      onInput={(e) => setAuthorName(e.currentTarget.value)}
                      class="text-xs"
                    />
                  </div>
                  <div>
                    <Label for="author-email">{t("Commit Author Email")}</Label>
                    <Input
                      id="author-email"
                      type="email"
                      placeholder="editorial@example.com"
                      value={authorEmail()}
                      onInput={(e) => setAuthorEmail(e.currentTarget.value)}
                      class="text-xs"
                    />
                  </div>
                </div>
                <p class="text-[11.5px] text-text-faint">
                  {t("Attached to commits made from the CMS publishing dashboard.")}
                </p>

                {/* GitHub API options */}
                <Show when={gitProvider() === 'github' || gitProvider() === 'auto'}>
                  <div class="border-t border-border pt-3 space-y-3">
                    <h3 class="text-xs font-semibold text-text">{t("GitHub Repository Connection")}</h3>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[420px]">
                      <div>
                        <Label for="github-repo">{t("Repository (owner/repo)")}</Label>
                        <Input
                          id="github-repo"
                          placeholder="owner/repo"
                          value={githubRepo()}
                          onInput={(e) => setGithubRepo(e.currentTarget.value)}
                          class="text-xs font-mono"
                        />
                      </div>
                      <div>
                        <Label for="github-branch">{t("Default Production Branch")}</Label>
                        <Input
                          id="github-branch"
                          placeholder="main"
                          value={githubBranch()}
                          onInput={(e) => setGithubBranch(e.currentTarget.value)}
                          class="text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <Label for="github-token">{t("Personal Access Token")}</Label>
                      <Input
                        id="github-token"
                        type="password"
                        placeholder={gitData()?.github?.has_token ? '••••••••••••••••' : 'ghp_xxxxxxxxxxxx'}
                        value={githubToken()}
                        onInput={(e) => setGithubToken(e.currentTarget.value)}
                        class="text-xs font-mono max-w-[420px]"
                      />
                      <p class="mt-1 text-[11.5px] text-text-faint">
                        {gitData()?.github?.has_token
                          ? t("A token is currently configured. Leave blank to keep it, or enter a new token to update.")
                          : t("Needs repo scope permissions to commit changes, create branches and open pull requests.")}
                      </p>
                    </div>
                  </div>
                </Show>

                <div class="pt-2">
                  <Button type="submit" variant="primary" size="sm" disabled={gitSaving()}>
                    <Check size={13} />
                    <span>{gitSaving() ? t("Saving…") : t("Save Git settings")}</span>
                  </Button>
                </div>
              </form>
            </Show>
          </Postbox>

          {/* Plugin Settings Panels */}
          <Show when={pluginPanels().length} fallback={<Postbox title={t("Plugins")}><p class="text-xs text-text-faint">{t("No enabled plugin has settings.")}</p></Postbox>}>
            <For each={pluginPanels()}>
              {(panel) => (
                <Postbox title={panel.name}>
                  <Show
                    when={custom(panel.plugin)}
                    fallback={
                      <FormFields fields={panel.settings} values={current()} onChange={change} />
                    }
                  >
                    {/* The element the plugin's stylesheet is scoped to. */}
                    <div data-pillar-plugin={panel.plugin}>
                      <Dynamic component={custom(panel.plugin)!.component} fields={panel.settings} values={current()} onChange={change} />
                    </div>
                  </Show>
                </Postbox>
              )}
            </For>
          </Show>
        </div>

        <div>
          <Postbox title={t("Site")}>
            <dl class="space-y-3 text-xs">
              <div>
                <dt class="text-text-muted">{t("Name")}</dt>
                <dd class="mt-0.5 text-[13px] text-text">{editorConfig.siteName}</dd>
              </div>
              <div>
                <dt class="text-text-muted">{t("Declared in")}</dt>
                <dd class="mt-0.5 font-mono text-text-secondary">site.json</dd>
              </div>
            </dl>
            <p class="mt-3 text-[11.5px] text-text-faint">{t("Base URL, plugins and deploy target are edited in site.json — they change what the build does, not how the site looks.")}</p>
          </Postbox>

          <Postbox title={t("Theme")}>
            <p class="text-xs text-text-muted">{t("Colours, layout and the site's name in its header are theme settings, edited beside a live preview.")}</p>
            <A href="/editor" class={`${buttonClass('secondary', 'sm')} mt-3`}>
              {t("Open the theme editor")} </A>
          </Postbox>
        </div>
      </SidebarLayout>
    </Page>
  );
}
