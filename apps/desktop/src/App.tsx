import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { Header } from './components/Header';
import { Launcher } from './components/Launcher';
import { SiteFrame } from './components/SiteFrame';
import { CreateSiteModal } from './components/CreateSiteModal';
import {
  api,
  type PhpInfo,
  type ServerStatus,
  type SiteInfo,
} from './lib/api';


export function App() {
  const [phpInfo, setPhpInfo] = createSignal<PhpInfo | null>(null);
  const [recentSites, setRecentSites] = createSignal<SiteInfo[]>([]);
  const [starterPath, setStarterPath] = createSignal<string | null>(null);
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
  const [reloadKey, setReloadKey] = createSignal(0);

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
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to start site server');
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
  };

  onMount(() => {
    loadInitialData();

    // Register native menu listeners
    let unlistenOpen: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;
    let unlistenFinder: (() => void) | undefined;

    api.listenMenuOpenSite(() => {
      handlePickFolder();
    }).then((un) => {
      unlistenOpen = un;
    });

    api.listenMenuCloseSite(() => {
      handleBackToLauncher();
    }).then((un) => {
      unlistenClose = un;
    });

    api.listenMenuRevealFinder(() => {
      const currentPath = status().site_path;
      if (currentPath) {
        api.openInFinder(currentPath);
      }
    }).then((un) => {
      unlistenFinder = un;
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pillar:close-site') {
        handleBackToLauncher();
      } else if (event.data?.type === 'pillar:reveal-finder') {
        const currentPath = status().site_path;
        if (currentPath) {
          api.openInFinder(currentPath);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    onCleanup(() => {
      unlistenOpen?.();
      unlistenClose?.();
      unlistenFinder?.();
      window.removeEventListener('message', handleMessage);
    });
  });

  return (
    <div class="h-screen w-screen flex flex-col bg-[#f6f6f7] text-[#202223] overflow-hidden font-sans">
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
            onOpenSite={handleOpenSite}
            onPickFolder={handlePickFolder}
            onCreateNew={() => setIsCreateModalOpen(true)}
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
      />
    </div>
  );
}
