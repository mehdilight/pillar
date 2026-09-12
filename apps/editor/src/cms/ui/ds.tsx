import { t } from '../../i18n';
import { For, Show, splitProps, type JSX } from 'solid-js';

/**
 * The CMS's primitives — bastet's design system (apps/design-system in that
 * repository), ported from React to Solid with its class strings unchanged, so
 * the two admins read as one product. React's `className` is `class`, `key`
 * props are gone, and props are read, never destructured.
 */

const buttonBase =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-ds border px-3 text-xs font-medium leading-none shadow-ds-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
export const buttonSecondary = `${buttonBase} border-border-strong bg-surface text-text hover:border-text-muted hover:bg-surface-muted`;
export const buttonPrimary = `${buttonBase} border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover bg-[linear-gradient(rgba(0,0,0,0)_63%,rgba(255,255,255,0.12)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`;
export const buttonDanger = `${buttonBase} border-danger bg-danger text-white hover:bg-[#bd260c] bg-[linear-gradient(rgba(0,0,0,0)_63%,rgba(255,255,255,0.12)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`;
export const buttonSuccess = `${buttonBase} border-success bg-success text-white hover:bg-[#00674d] bg-[linear-gradient(rgba(0,0,0,0)_63%,rgba(255,255,255,0.12)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`;

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'link';

export function buttonClass(variant: Variant = 'secondary', size: 'sm' | 'md' | 'lg' = 'md'): string {
  const tone =
    variant === 'primary'
      ? buttonPrimary
      : variant === 'link'
        ? 'border-0 bg-transparent p-0 text-brand shadow-none hover:underline'
        : variant === 'danger'
          ? buttonDanger
          : variant === 'success'
            ? buttonSuccess
            : buttonSecondary;
  const sizeClass = size === 'sm' ? 'h-7 px-2.5 text-xs' : size === 'lg' ? 'h-9 px-4 text-[13px]' : '';

  return `${tone} ${sizeClass}`;
}

export function Button(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }
) {
  const [own, rest] = splitProps(props, ['variant', 'size', 'class']);

  return <button type="button" {...rest} class={`${buttonClass(own.variant, own.size)} ${own.class ?? ''}`} />;
}

export function Badge(props: {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  class?: string;
  children: JSX.Element;
}) {
  const tone = () =>
    ({
      default: 'border-border-strong bg-surface-muted text-text-secondary',
      success: 'border-success/30 bg-success-tint text-success',
      danger: 'border-danger/30 bg-danger-tint text-danger',
      warning: 'border-warning/30 bg-warning-tint text-warning',
      info: 'border-brand/30 bg-brand-tint text-brand',
    })[props.variant ?? 'default'];

  return (
    <span class={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${tone()} ${props.class ?? ''}`}>
      {props.children}
    </span>
  );
}

const control =
  'h-8 w-full max-w-[420px] rounded-ds border border-border-strong bg-surface px-2.5 text-[13px] leading-6 text-text outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-tint disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-faint';

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [own, rest] = splitProps(props, ['class']);

  return <input {...rest} class={`${control} ${own.class ?? ''}`} />;
}

export function Textarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [own, rest] = splitProps(props, ['class']);

  return <textarea {...rest} class={`${control} h-auto min-h-20 resize-y py-2 leading-normal ${own.class ?? ''}`} />;
}

export function Label(props: { for?: string; class?: string; children: JSX.Element }) {
  return (
    <label for={props.for} class={`mb-1 block text-xs font-medium text-text-secondary ${props.class ?? ''}`}>
      {props.children}
    </label>
  );
}

/** A titled white box — bastet's "postbox", from the WordPress lineage of its admin. */
export function Postbox(props: { title?: JSX.Element; flush?: boolean; actions?: JSX.Element; children: JSX.Element }) {
  return (
    <section class="mb-4 min-w-0 rounded-ds border border-border bg-surface shadow-ds-sm">
      <Show when={props.title}>
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-[13px] font-semibold leading-[1.4] text-text">{props.title}</h2>
          {props.actions}
        </header>
      </Show>
      <div class={props.flush ? 'p-0' : 'p-4'}>{props.children}</div>
    </section>
  );
}

export function Notice(props: { type?: 'error' | 'success' | 'warning' | 'info'; children: JSX.Element }) {
  const tone = () =>
    ({
      error: 'bg-danger-tint text-danger before:bg-danger',
      success: 'bg-success-tint text-success before:bg-success',
      warning: 'bg-warning-tint text-warning before:bg-warning',
      info: 'bg-brand-tint text-brand before:bg-brand',
    })[props.type ?? 'info'];

  return (
    <div
      class={`relative mb-4 overflow-hidden rounded-ds px-4 py-2.5 pl-5 text-[13px] before:absolute before:inset-y-0 before:left-0 before:w-1 ${tone()}`}
      role="status"
    >
      <p class="m-0">{props.children}</p>
    </div>
  );
}

export function Tile(props: { label: string; value: JSX.Element; hint?: string }) {
  return (
    <div class="min-w-0 rounded-ds border border-border bg-surface p-4 shadow-ds-sm">
      <p class="m-0 text-xs uppercase tracking-[.04em] text-text-muted">{props.label}</p>
      <p class="mt-2 text-2xl font-normal leading-tight text-text">{props.value}</p>
      <Show when={props.hint}>
        <p class="mt-1.5 text-[11.5px] text-text-faint">{props.hint}</p>
      </Show>
    </div>
  );
}

export interface FilterItem {
  key: string;
  label: string;
  count?: number;
}

export function Filters(props: { items: FilterItem[]; current: string; onChange: (key: string) => void }) {
  return (
    <ul class="mb-3.5 flex flex-wrap items-center gap-1.5">
      <For each={props.items}>
        {(item) => (
          <li>
            <button
              type="button"
              class="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors"
              classList={{
                'border-brand bg-brand text-white': props.current === item.key,
                'border-border-strong text-text-secondary hover:bg-surface-muted hover:text-text': props.current !== item.key,
              }}
              onClick={() => props.onChange(item.key)}
              aria-pressed={props.current === item.key}
            >
              {item.label}
              <Show when={item.count !== undefined}>
                <span classList={{ 'text-white/75': props.current === item.key, 'text-text-faint': props.current !== item.key }}>
                  ({item.count})
                </span>
              </Show>
            </button>
          </li>
        )}
      </For>
    </ul>
  );
}

export function Pager(props: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  return (
    <div class="mt-3.5 flex flex-wrap items-center justify-end gap-2.5 text-xs text-text-muted">
      <span>
        {t("count.item", { count: props.total })}
      </span>
      <Show when={props.pages > 1}>
        <span class="inline-flex items-center gap-1">
          <button type="button" class={buttonSecondary} disabled={props.page <= 1} onClick={() => props.onChange(props.page - 1)} aria-label={t("Previous page")}>
            ‹
          </button>
          <span class="px-0.5 tabular-nums text-text-secondary">
            {props.page} {t("of")} {props.pages}
          </span>
          <button type="button" class={buttonSecondary} disabled={props.page >= props.pages} onClick={() => props.onChange(props.page + 1)} aria-label={t("Next page")}>
            ›
          </button>
        </span>
      </Show>
    </div>
  );
}

export function SidebarLayout(props: { variant?: 'wide' | 'form'; children: JSX.Element }) {
  const template = () =>
    props.variant === 'form' ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : 'lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]';

  return <div class={`grid gap-4 ${template()}`}>{props.children}</div>;
}

export function Grid(props: { cols?: 2 | 3 | 4; children: JSX.Element }) {
  const cols = () =>
    ({
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    })[props.cols ?? 3];

  return <div class={`grid gap-4 ${cols()}`}>{props.children}</div>;
}

/* ── Table ──────────────────────────────────────────────────────────── */

export function Table(props: { children: JSX.Element }) {
  return (
    <div class="w-full overflow-x-auto rounded-ds border border-border bg-surface shadow-ds-sm">
      <table class="w-full border-collapse text-[13px]">{props.children}</table>
    </div>
  );
}

export const TableHeader = (props: { children: JSX.Element }) => (
  <thead class="[&_tr]:border-b [&_tr]:border-border">{props.children}</thead>
);

export const TableBody = (props: { children: JSX.Element }) => (
  <tbody class="[&_tr:last-child]:border-0">{props.children}</tbody>
);

export const TableRow = (props: { children: JSX.Element }) => (
  <tr class="border-b border-border transition-colors hover:bg-surface-muted">{props.children}</tr>
);

export const TableHead = (props: { class?: string; style?: JSX.CSSProperties; children?: JSX.Element }) => (
  <th
    class={`h-9 bg-surface-muted px-3 text-start text-[11.5px] font-medium uppercase tracking-[.03em] text-text-muted ${props.class ?? ''}`}
    style={props.style}
  >
    {props.children}
  </th>
);

export const TableCell = (props: { class?: string; children?: JSX.Element }) => (
  <td class={`border-b border-border px-3 py-2.5 align-middle text-start text-[13px] text-text-secondary last:border-0 ${props.class ?? ''}`}>
    {props.children}
  </td>
);

/** What an empty list says — bastet's pages use this shape inline. */
export function Empty(props: { title: string; description?: string; action?: JSX.Element }) {
  return (
    <div class="p-12 text-center rounded-ds border border-border bg-surface">
      <p class="text-sm font-medium text-text">{props.title}</p>
      <Show when={props.description}>
        <p class="text-xs text-text-faint mt-1">{props.description}</p>
      </Show>
      <Show when={props.action}>
        <div class="mt-4 inline-block">{props.action}</div>
      </Show>
    </div>
  );
}

export function Loading(props: { label?: string }) {
  return <div class="p-8 text-center text-xs text-text-faint">{props.label ?? t("Loading…")}</div>;
}
