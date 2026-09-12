import { createEffect, createSignal, onMount, Show } from 'solid-js';
import { ArrowsClockwiseIcon, WarningCircleIcon } from './Icons';

interface SiteFrameProps {
  url: string;
  siteName?: string;
  reloadKey: number;
}

export function SiteFrame(props: SiteFrameProps) {
  const [isLoading, setIsLoading] = createSignal(true);
  const [hasError, setHasError] = createSignal(false);
  let iframeRef: HTMLIFrameElement | undefined;

  createEffect(() => {
    if (props.reloadKey > 0 && iframeRef) {
      setIsLoading(true);
      setHasError(false);
      iframeRef.src = props.url;
    }
  });

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const retry = () => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef) {
      iframeRef.src = props.url;
    }
  };

  onMount(() => {
    const timer = setTimeout(() => {
      if (isLoading()) {
        // Still loading after 8s
      }
    }, 8000);
    return () => clearTimeout(timer);
  });

  return (
    <div class="relative flex-1 w-full h-full bg-stone-950 overflow-hidden">
      {/* Loading Shimmer / Spinner */}
      <Show when={isLoading()}>
        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-stone-950/90 backdrop-blur-xs gap-3 select-none">
          <div class="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <div class="flex flex-col items-center gap-1">
            <span class="text-sm font-semibold text-stone-200">
              Starting {props.siteName || 'Pillar Site'}...
            </span>
            <span class="text-xs text-stone-500 font-mono">
              {props.url}
            </span>
          </div>
        </div>
      </Show>

      {/* Error state */}
      <Show when={hasError()}>
        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-stone-950 p-6 text-center gap-4 select-none">
          <div class="p-3 rounded-full bg-rose-950/60 border border-rose-800 text-rose-400">
            <WarningCircleIcon size={32} />
          </div>
          <div class="flex flex-col gap-1 max-w-sm">
            <h3 class="text-base font-semibold text-stone-100">
              Could not connect to site server
            </h3>
            <p class="text-xs text-stone-400">
              The local PHP server may still be initializing or the port was closed.
            </p>
          </div>
          <button
            onClick={retry}
            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <ArrowsClockwiseIcon size={14} />
            <span>Retry Connection</span>
          </button>
        </div>
      </Show>

      {/* Embedded site editor iframe */}
      <iframe
        ref={iframeRef}
        src={props.url}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        class="w-full h-full border-0 bg-stone-950"
        allow="clipboard-read; clipboard-write; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
      />
    </div>
  );
}
