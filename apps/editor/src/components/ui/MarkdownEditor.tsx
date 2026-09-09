import { Show, createSignal, onCleanup } from 'solid-js';
import { Bold, Code, Eye, Heading2, Italic, Link2, List, Quote, SplitSquareHorizontal } from 'lucide-solid';
import { api } from '../../api/client';

type View = 'write' | 'split' | 'preview';

interface MarkdownEditorProps {
  value: string;
  onValue: (value: string) => void;
  minHeight?: number;
  placeholder?: string;
}

/**
 * A markdown editor with a formatting toolbar and a live preview.
 *
 * Deliberately *not* a rich-text surface that serialises to markdown. Content
 * here is committed to a repository and read by people in their own editors; a
 * round trip through HTML mangles exactly the things a writer cares about —
 * fenced code, reference links, tables — and the diff of a saved file stops
 * resembling what was typed. The toolbar writes markdown, and what is stored is
 * what was typed.
 *
 * The preview renders through the site's own converter (`POST /api/markdown`),
 * so it matches what the build will write rather than what a second markdown
 * implementation in the browser thinks.
 */
export default function MarkdownEditor(props: MarkdownEditorProps) {
  const [view, setView] = createSignal<View>('write');
  const [html, setHtml] = createSignal('');
  let area: HTMLTextAreaElement | undefined;
  let timer: number | undefined;

  onCleanup(() => window.clearTimeout(timer));

  const renderPreview = (markdown: string) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        setHtml((await api.markdown(markdown)).html);
      } catch {
        // No backend (the fixture client) — the raw text is a poor preview but
        // an honest one, and better than a blank pane.
        setHtml(`<pre>${markdown.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!)}</pre>`);
      }
    }, 250);
  };

  const show = (next: View) => {
    setView(next);

    if (next !== 'write') renderPreview(props.value);
  };

  const change = (value: string) => {
    props.onValue(value);

    if (view() !== 'write') renderPreview(value);
  };

  /**
   * Wrap the selection, or insert the marker and put the caret inside it.
   *
   * Selection is restored afterwards so a writer can hit ⌘B twice without
   * losing their place — the thing that makes a toolbar feel broken.
   */
  const wrap = (before: string, after = before, placeholder = '') => {
    if (!area) return;

    const { selectionStart: start, selectionEnd: end, value } = area;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);

    change(next);

    queueMicrotask(() => {
      area!.focus();
      area!.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  /** Prefix every line the selection touches — lists, quotes, headings. */
  const prefix = (marker: string) => {
    if (!area) return;

    const { selectionStart: start, selectionEnd: end, value } = area;
    const from = value.lastIndexOf('\n', start - 1) + 1;
    const to = value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end);
    const block = value.slice(from, to);
    const already = block.split('\n').every((line) => line.startsWith(marker));

    const next = block
      .split('\n')
      .map((line) => (already ? line.slice(marker.length) : marker + line))
      .join('\n');

    change(value.slice(0, from) + next + value.slice(to));

    queueMicrotask(() => {
      area!.focus();
      area!.setSelectionRange(from, from + next.length);
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return;

    const key = event.key.toLowerCase();

    if (key === 'b') {
      event.preventDefault();
      wrap('**', '**', 'bold text');
    }

    if (key === 'i') {
      event.preventDefault();
      wrap('_', '_', 'italic text');
    }

    if (key === 'k') {
      event.preventDefault();
      wrap('[', '](https://)', 'link text');
    }
  };

  const tool = (label: string, icon: () => any, run: () => void, shortcut?: string) => (
    <button
      type="button"
      class="ed-rte-btn p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4] transition-colors"
      title={shortcut ? `${label} (${shortcut})` : label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    >
      {icon()}
    </button>
  );

  return (
    <div class="ed-rte rounded-xl border border-[#e1e3e5] bg-white overflow-hidden">
      <div class="ed-rte-toolbar flex items-center gap-0.5 px-1.5 py-1 border-b border-[#e1e3e5] bg-[#fbfbfc]">
        {tool('Bold', () => <Bold size={14} />, () => wrap('**', '**', 'bold text'), '⌘B')}
        {tool('Italic', () => <Italic size={14} />, () => wrap('_', '_', 'italic text'), '⌘I')}
        {tool('Heading', () => <Heading2 size={14} />, () => prefix('## '))}
        {tool('Link', () => <Link2 size={14} />, () => wrap('[', '](https://)', 'link text'), '⌘K')}
        {tool('List', () => <List size={14} />, () => prefix('- '))}
        {tool('Quote', () => <Quote size={14} />, () => prefix('> '))}
        {tool('Code', () => <Code size={14} />, () => wrap('`', '`', 'code'))}

        <div class="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            class="p-1.5 rounded-md transition-colors"
            classList={{
              'bg-[#e9eef7] text-[#005bd3]': view() === 'split',
              'text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4]': view() !== 'split',
            }}
            title="Write and preview"
            onClick={() => show(view() === 'split' ? 'write' : 'split')}
          >
            <SplitSquareHorizontal size={14} />
          </button>
          <button
            type="button"
            class="p-1.5 rounded-md transition-colors"
            classList={{
              'bg-[#e9eef7] text-[#005bd3]': view() === 'preview',
              'text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4]': view() !== 'preview',
            }}
            title="Preview"
            onClick={() => show(view() === 'preview' ? 'write' : 'preview')}
          >
            <Eye size={14} />
          </button>
        </div>
      </div>

      <div class="flex" style={{ 'min-height': `${props.minHeight ?? 320}px` }}>
        <Show when={view() !== 'preview'}>
          <textarea
            ref={area}
            class="flex-1 w-full p-4 text-[13px] font-mono leading-relaxed outline-none resize-none border-0 focus:ring-0"
            classList={{ 'border-r border-[#e1e3e5]': view() === 'split' }}
            spellcheck={true}
            placeholder={props.placeholder}
            value={props.value}
            onInput={(event) => change(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
        </Show>

        <Show when={view() !== 'write'}>
          <div class="ed-rte-body flex-1 p-4 overflow-auto prose-preview" innerHTML={html()} />
        </Show>
      </div>
    </div>
  );
}
