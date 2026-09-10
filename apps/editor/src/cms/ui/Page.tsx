import { Show, type JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { ArrowLeft } from '../../components/ui/Icons';

/**
 * A CMS page: title, optional back link, actions, content.
 *
 * bastet's `components/Page.tsx`, ported — the title bar and its rule are what
 * make every screen in the admin read as the same product.
 */
export default function Page(props: {
  title: JSX.Element;
  backTo?: string;
  actions?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <div class="min-h-[calc(100vh-3.5rem)] max-w-6xl bg-canvas px-6 py-6 pb-12 text-[13px] text-text">
      <div class="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div class="flex items-center gap-3 min-w-0">
          <Show when={props.backTo}>
            <A
              href={props.backTo!}
              class="size-8 flex items-center justify-center rounded-ds border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-muted transition-colors shrink-0 shadow-xs"
              title="Back"
            >
              <ArrowLeft size={16} />
            </A>
          </Show>
          <h1 class="text-xl font-semibold leading-tight tracking-[-0.015em] text-text truncate">{props.title}</h1>
        </div>

        <Show when={props.actions}>
          <div class="flex items-center gap-2 shrink-0">{props.actions}</div>
        </Show>
      </div>
      <div class="pt-[18px]">{props.children}</div>
    </div>
  );
}
