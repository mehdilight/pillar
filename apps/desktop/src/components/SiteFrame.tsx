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
    <div class="relative flex-1 w-full h-full bg-[#f6f6f7] overflow-hidden">
      {/* Loading Shimmer / Spinner */}
      <Show when={isLoading()}>
        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#f6f6f7]/95 backdrop-blur-xs gap-3 select-none">
          <div class="w-8 h-8 rounded-full border-2 border-[#005bd3] border-t-transparent animate-spin" />
          <div class="flex flex-col items-center gap-1">
            <span class="text-sm font-semibold text-[#202223]">
              Starting {props.siteName || 'Pillar Site'}…
            </span>
            <span class="text-xs text-[#6d7175] font-mono">
              {props.url}
            </span>
          </div>
        </div>
      </Show>

      {/* Error state */}
      <Show when={hasError()}>
        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#f6f6f7] p-6 text-center gap-4 select-none">
          <div class="p-3 rounded-full bg-[rgba(216,44,13,0.08)] border border-[rgba(216,44,13,0.3)] text-[#d82c0d]">
            <WarningCircleIcon size={28} />
          </div>
          <div class="flex flex-col gap-1 max-w-sm">
            <h3 class="text-sm font-semibold text-[#202223]">
              Could not connect to site server
            </h3>
            <p class="text-xs text-[#6d7175]">
              The local PHP server may still be initializing or the port was closed.
            </p>
          </div>
          <button
            onClick={retry}
            class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#005bd3] bg-[#005bd3] px-3 text-xs font-medium leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-[#004bb5] hover:bg-[#004bb5] transition-colors cursor-pointer"
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
        class="w-full h-full border-0 bg-white"
        allow="clipboard-read; clipboard-write; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
      />
    </div>
  );
}
