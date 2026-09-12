import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { listen } from '@tauri-apps/api/event';
import { Header } from './components/Header';
import { Launcher } from './components/Launcher';
import { SiteFrame } from './components/SiteFrame';
import { CreateSiteModal } from './components/CreateSiteModal';
import { ConnectGitHubModal } from './components/ConnectGitHubModal';
import { CloneRepoModal } from './components/CloneRepoModal';
import { QuickSwitcherModal } from './components/QuickSwitcherModal';
import {
  api,
  type GitHubUser,
  type PhpInfo,
  type ServerStatus,
  type SiteInfo,
} from './lib/api';

export function App() {
  const [phpInfo, setPhpInfo] = createSignal<PhpInfo | null>(null);
  const [recentSites, setRecentSites] = createSignal<SiteInfo[]>([]);
  const [starterPath, setStarterPath] = createSignal<string | null>(null);
  const [githubUser, setGithubUser] = createSignal<GitHubUser | null>(null);
  const [status, setStatus] = createSignal<ServerStatus>({
    running: false,
    port: null,
    site_path: null,
    site_name: null,
    url: null,
    preview_url: null,
  });

  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = createSignal(false);
  const [isConnectGithubOpen, setIsConnectGithubOpen] = createSignal(false);
  const [isCloneGithubOpen, setIsCloneGithubOpen] = createSignal(false);
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = createSignal(false);
  const [reloadKey, setReloadKey] = createSignal(0);
  const [toast, setToast] = createSignal<{ text: string; type: 'info' | 'success' | 'error' } | null>(
    null
  );

  let toastTimer: any = null;
  const showToast = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast({ text, type });
    toastTimer = setTimeout(() => setToast(null), 3500);
  };

  const refreshGithubStatus = async () => {
    try {
      const auth = await api.getGithubStatus();
      setGithubUser(auth.authenticated ? auth.user : null);
    } catch (err) {
      console.warn('Failed to get GitHub status:', err);
    }
  };

  const loadInitialData = async () => {
    try {
      const [php, recents, currentStatus] = await Promise.all([
        api.detectPhp(),
        api.getRecentSites(),
        api.getServerStatus(),
      ]);
      setPhpInfo(php);
      setRecentSites(recents);
      setStatus(currentStatus);
      await refreshGithubStatus();

      try {
        const starter = await api.getStarterExamplePath();
        setStarterPath(starter);
      } catch {
        // Not in dev workspace, ignore
      }
    } catch (err: any) {
      console.error('Failed to initialize desktop app:', err);
    }
  };

  const handleOpenSite = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const server = await api.startSiteServer(path);
      setStatus(server);
      const recents = await api.getRecentSites();
      setRecentSites(recents);
      showToast(`Started ${server.site_name || 'site'}`, 'success');
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to start site server');
      showToast('Failed to start site server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      const picked = await api.pickFolder();
      if (picked) {
        await handleOpenSite(picked);
      }
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to select folder');
    }
  };

  const handleBackToLauncher = async () => {
    setIsLoading(true);
    try {
      const stopped = await api.stopSiteServer();
      setStatus(stopped);
    } catch (err: any) {
      console.error('Failed to stop server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRecent = async (path: string) => {
    try {
      const updated = await api.removeRecentSite(path);
      setRecentSites(updated);
    } catch (err: any) {
      console.error('Failed to remove recent site:', err);
    }
  };

  const handleReload = () => {
    setReloadKey((k) => k + 1);
    showToast('Reloaded editor view', 'info');
  };

  const handleOpenCodeEditor = async (targetPath?: string) => {
    const p = targetPath || status().site_path;
    if (p) {
      try {
        await api.openInCodeEditor(p);
        showToast('Opened in code editor', 'success');
      } catch (err: any) {
        showToast(String(err), 'error');
      }
    }
  };

  const handleBuildStatic = async (targetPath?: string) => {
    const p = targetPath || status().site_path;
    if (p) {
      showToast('Building static site…', 'info');
      try {
        const msg = await api.buildStaticSite(p);
        showToast(msg || 'Built static site to dist/', 'success');
      } catch (err: any) {
        showToast(String(err), 'error');
      }
    }
  };

  const handleSyncGithub = async (targetPath?: string) => {
    const p = targetPath || status().site_path;
    if (p) {
      showToast('Syncing with GitHub…', 'info');
      try {
        const msg = await api.syncGitSite(p);
        showToast(msg || 'Synced with GitHub!', 'success');
      } catch (err: any) {
        showToast(String(err), 'error');
      }
    }
  };

  onMount(() => {
    loadInitialData();

    // Native menu listeners
    const unsubs: Array<() => void> = [];

    api.listenMenuNewSite(() => setIsCreateModalOpen(true)).then((un) => unsubs.push(un));
    api.listenMenuOpenSite(() => handlePickFolder()).then((un) => unsubs.push(un));
    api.listenMenuCloseSite(() => handleBackToLauncher()).then((un) => unsubs.push(un));
    api.listenMenuRevealFinder(() => {
      const p = status().site_path;
      if (p) api.openInFinder(p);
    }).then((un) => unsubs.push(un));
    api.listenMenuOpenCodeEditor(() => handleOpenCodeEditor()).then((un) => unsubs.push(un));
    api.listenMenuExportSite(() => handleBuildStatic()).then((un) => unsubs.push(un));
    api.listenMenuSyncGithub(() => handleSyncGithub()).then((un) => unsubs.push(un));

    // Native Drag and drop listener
    listen<{ paths: string[] }>('tauri://drag-drop', async (event) => {
      const paths = event.payload.paths;
      if (paths && paths.length > 0) {
        const dropped = paths[0];
        try {
          const val = await api.validateSite(dropped);
          if (val.valid) {
            await handleOpenSite(dropped);
          } else {
            showToast('Dropped folder is not a valid Pillar site folder', 'error');
          }
        } catch {
          showToast('Could not open dropped folder', 'error');
        }
      }
    }).then((un) => unsubs.push(un));

    // Iframe postMessage listener
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pillar:close-site') {
        handleBackToLauncher();
      } else if (event.data?.type === 'pillar:reveal-finder') {
        const currentPath = status().site_path;
        if (currentPath) api.openInFinder(currentPath);
      } else if (event.data?.type === 'pillar:open-code-editor') {
        handleOpenCodeEditor();
      } else if (event.data?.type === 'pillar:build-static') {
        handleBuildStatic();
      } else if (event.data?.type === 'pillar:sync-github') {
        handleSyncGithub();
      }
    };
    window.addEventListener('message', handleMessage);

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'k') && !e.shiftKey) {
        e.preventDefault();
        setIsQuickSwitcherOpen((prev) => !prev);
      } else if (mod && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        handlePickFolder();
      } else if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        setIsCreateModalOpen(true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const p = status().site_path;
        if (p) api.openInFinder(p);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleOpenCodeEditor();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleBuildStatic();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleSyncGithub();
      } else if (mod && e.key.toLowerCase() === 'r' && !e.shiftKey) {
        e.preventDefault();
        handleReload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    onCleanup(() => {
      for (const un of unsubs) un();
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('keydown', handleKeyDown);
      if (toastTimer) clearTimeout(toastTimer);
    });
  });

  return (
    <div class="h-screen w-screen flex flex-col bg-[#f6f6f7] text-[#202223] overflow-hidden font-sans select-none">
      <Show when={!status().running}>
        <Header
          status={status()}
          onBackToLauncher={handleBackToLauncher}
          onReload={handleReload}
        />
      </Show>

      <Show
        when={status().running && status().url}
        fallback={
          <Launcher
            phpInfo={phpInfo()}
            recentSites={recentSites()}
            starterPath={starterPath()}
            githubUser={githubUser()}
            onOpenSite={handleOpenSite}
            onPickFolder={handlePickFolder}
            onCreateNew={() => setIsCreateModalOpen(true)}
            onConnectGithub={() => setIsConnectGithubOpen(true)}
            onCloneGithub={() => setIsCloneGithubOpen(true)}
            onRemoveRecent={handleRemoveRecent}
            isLoading={isLoading()}
            error={error()}
          />
        }
      >
        {(url) => (
          <SiteFrame
            url={url()}
            siteName={status().site_name || undefined}
            reloadKey={reloadKey()}
          />
        )}
      </Show>

      <CreateSiteModal
        isOpen={isCreateModalOpen()}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(path) => handleOpenSite(path)}
        githubUser={githubUser()}
      />

      <ConnectGitHubModal
        isOpen={isConnectGithubOpen()}
        onClose={() => setIsConnectGithubOpen(false)}
        currentUser={githubUser()}
        onAuthChange={refreshGithubStatus}
      />

      <CloneRepoModal
        isOpen={isCloneGithubOpen()}
        onClose={() => setIsCloneGithubOpen(false)}
        onCloned={(site) => handleOpenSite(site.path)}
      />

      <QuickSwitcherModal
        isOpen={isQuickSwitcherOpen()}
        onClose={() => setIsQuickSwitcherOpen(false)}
        recentSites={recentSites()}
        serverStatus={status()}
        onOpenSite={handleOpenSite}
        onCreateNew={() => setIsCreateModalOpen(true)}
        onPickFolder={handlePickFolder}
        onCloneGithub={() => setIsCloneGithubOpen(true)}
        onRevealFinder={() => {
          const p = status().site_path;
          if (p) api.openInFinder(p);
        }}
        onOpenCodeEditor={() => handleOpenCodeEditor()}
        onBuildStatic={() => handleBuildStatic()}
        onSyncGithub={() => handleSyncGithub()}
        onCloseSite={() => handleBackToLauncher()}
      />

      {/* Floating Toast Notification */}
      <Show when={toast()}>
        {(t) => (
          <div
            class="fixed bottom-5 right-5 z-[200] max-w-sm px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium flex items-center gap-2 transition-all"
            classList={{
              'bg-[#202223] text-white border-[#3e4045]': t().type === 'info',
              'bg-[#008060] text-white border-[#006e52]': t().type === 'success',
              'bg-[#d82c0d] text-white border-[#b7240a]': t().type === 'error',
            }}
          >
            <span>{t().text}</span>
          </div>
        )}
      </Show>
    </div>
  );
}
