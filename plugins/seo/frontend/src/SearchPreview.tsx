import { Show } from 'solid-js';

export default function SearchPreview(props: { title: string; description: string; url: string; hidden?: boolean; loading?: boolean }) {
  return <div class="rounded-lg border border-[#e1e3e5] p-3 mb-4 bg-white" aria-label="Search result preview">
    <p class="text-[11px] font-medium text-gray-500 mb-2">How it could look in search</p>
    <p class="text-[11px] text-[#202223] truncate">{props.url}</p>
    <p class="text-[18px] leading-6 text-[#1a0dab] mt-1 break-words">{props.title}</p>
    <p class="text-xs leading-5 text-[#4d5156] mt-1 break-words">{props.description || 'A description will be taken from your page.'}</p>
    <Show when={props.hidden}><p class="text-xs text-amber-700 mt-2">This page is hidden from search engines.</p></Show>
    <Show when={props.loading}><p class="ed-hint" role="status">Updating…</p></Show>
  </div>;
}
