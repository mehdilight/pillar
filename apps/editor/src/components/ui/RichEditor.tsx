import { For, Show, createEffect, createSignal, on, onCleanup, onMount, type JSX } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import {
  Bold,
  Code,
  FileCode,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
} from 'lucide-solid';
import Modal from './Modal';
import MediaLibrary from '../MediaLibrary';
import { joinSoftBreaks, tidyMarkdown } from '../../lib/markdown';

/**
 * The content editor: TipTap, reading and writing markdown.
 *
 * Visual editing over a markdown file, not instead of one. Entries are
 * committed to a repository and read by people in their own editors, so what
 * is stored stays markdown — `@tiptap/markdown` parses it in and
 * `getMarkdown()` writes it out.
 *
 * Two guards keep a file honest:
 *
 * - **Nothing is re-serialised until someone edits.** A parse/serialise round
 *   trip is not byte-identical for everything — a table's columns get
 *   re-padded — so merely opening an entry must never rewrite it. Until the
 *   first real edit, the original text is what `value` stays.
 * - **A source view.** Anything the visual editor cannot represent is still
 *   editable as the markdown it is, and edits made there are stored exactly as
 *   typed.
 *
 * `format="html"` serves `richtext` settings, which store HTML.
 */
export default function RichEditor(props: {
  value: string;
  onValue: (value: string) => void;
  format?: 'markdown' | 'html';
  minHeight?: number;
  placeholder?: string;
}) {
  const format = () => props.format ?? 'markdown';
  const [editor, setEditor] = createSignal<Editor>();
  const [tick, setTick] = createSignal(0);
  const [source, setSource] = createSignal(false);
  const [linking, setLinking] = createSignal(false);
  const [linkUrl, setLinkUrl] = createSignal('');
  const [choosingImage, setChoosingImage] = createSignal(false);

  let element!: HTMLDivElement;

  // What this component last handed out: an incoming value equal to it is
  // our own echo, not new content to load.
  let emitted = props.value;

  onMount(() => {
    const instance = new Editor({
      element,
      extensions: [
        StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
        TableKit.configure({ table: { resizable: false } }),
        Image,
        Placeholder.configure({ placeholder: props.placeholder ?? 'Start writing…' }),
        Markdown,
      ],
      editorProps: { attributes: { class: 'tiptap-content', spellcheck: 'true' } },
      // Fires on edits only — never for the initial content, and never for a
      // setContent below, which passes emitUpdate: false.
      onUpdate: ({ editor: current }) => {
        emitted = format() === 'markdown' ? tidyMarkdown(current.getMarkdown()) : current.getHTML();
        props.onValue(emitted);
      },
      onTransaction: () => setTick((n) => n + 1),
    });

    load(instance, props.value);
    setEditor(instance);
    onCleanup(() => instance.destroy());
  });

  /**
   * Put a value into the document without it counting as an edit. Markdown
   * is parsed here rather than by `setContent` so soft line breaks can be
   * joined first — see `joinSoftBreaks`.
   */
  function load(instance: Editor, value: string) {
    const content = format() === 'markdown' && instance.markdown ? joinSoftBreaks(instance.markdown.parse(value)) : value;

    // Out of the undo history: ⌘Z straight after opening an entry must not
    // undo the loading of it, leaving an empty document.
    instance
      .chain()
      .setMeta('addToHistory', false)
      .setContent(content, { contentType: format() === 'markdown' ? 'json' : 'html', emitUpdate: false })
      .run();
  }

  // A new value from outside — another entry loaded, a discard — replaces
  // the document, without echoing it back as an edit.
  createEffect(
    on(
      () => props.value,
      (value) => {
        const instance = editor();

        if (!instance || value === emitted) return;

        emitted = value;
        load(instance, value);
      },
      { defer: true }
    )
  );

  const run = (command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
    const instance = editor();

    if (instance) command(instance.chain().focus()).run();
  };

  const active = (name: string, attributes?: Record<string, unknown>) => {
    tick();

    return editor()?.isActive(name, attributes) ?? false;
  };

  const can = (check: (instance: Editor) => boolean) => {
    tick();

    const instance = editor();

    return instance ? check(instance) : false;
  };

  const openLink = () => {
    setLinkUrl(String(editor()?.getAttributes('link').href ?? ''));
    setLinking(true);
  };

  const applyLink = () => {
    const url = linkUrl().trim();

    run((chain) =>
      url === '' ? chain.extendMarkRange('link').unsetLink() : chain.extendMarkRange('link').setLink({ href: url })
    );
    setLinking(false);
  };

  const toggleSource = () => {
    const instance = editor();

    if (source() && instance) {
      // Back to visual: load what was typed in the source view.
      emitted = props.value;
      load(instance, props.value);
    }

    setSource(!source());
  };

  const tools: Array<
    | { label: string; icon: () => JSX.Element; run: () => void; active?: () => boolean; enabled?: () => boolean }
    | 'divider'
  > = [
    { label: 'Heading', icon: () => <Heading2 size={15} />, run: () => run((c) => c.toggleHeading({ level: 2 })), active: () => active('heading', { level: 2 }) },
    { label: 'Subheading', icon: () => <Heading3 size={15} />, run: () => run((c) => c.toggleHeading({ level: 3 })), active: () => active('heading', { level: 3 }) },
    'divider',
    { label: 'Bold (⌘B)', icon: () => <Bold size={15} />, run: () => run((c) => c.toggleBold()), active: () => active('bold') },
    { label: 'Italic (⌘I)', icon: () => <Italic size={15} />, run: () => run((c) => c.toggleItalic()), active: () => active('italic') },
    { label: 'Strikethrough', icon: () => <Strikethrough size={15} />, run: () => run((c) => c.toggleStrike()), active: () => active('strike') },
    { label: 'Inline code', icon: () => <Code size={15} />, run: () => run((c) => c.toggleCode()), active: () => active('code') },
    { label: 'Link', icon: () => <Link2 size={15} />, run: openLink, active: () => active('link') },
    'divider',
    { label: 'Bulleted list', icon: () => <List size={15} />, run: () => run((c) => c.toggleBulletList()), active: () => active('bulletList') },
    { label: 'Numbered list', icon: () => <ListOrdered size={15} />, run: () => run((c) => c.toggleOrderedList()), active: () => active('orderedList') },
    { label: 'Quote', icon: () => <Quote size={15} />, run: () => run((c) => c.toggleBlockquote()), active: () => active('blockquote') },
    { label: 'Code block', icon: () => <SquareCode size={15} />, run: () => run((c) => c.toggleCodeBlock()), active: () => active('codeBlock') },
    { label: 'Divider', icon: () => <Minus size={15} />, run: () => run((c) => c.setHorizontalRule()) },
    { label: 'Table', icon: () => <Table size={15} />, run: () => run((c) => c.insertTable({ rows: 3, cols: 2, withHeaderRow: true })) },
    { label: 'Image', icon: () => <ImagePlus size={15} />, run: () => setChoosingImage(true) },
    'divider',
    { label: 'Undo (⌘Z)', icon: () => <Undo2 size={15} />, run: () => run((c) => c.undo()), enabled: () => can((i) => i.can().undo()) },
    { label: 'Redo (⌘⇧Z)', icon: () => <Redo2 size={15} />, run: () => run((c) => c.redo()), enabled: () => can((i) => i.can().redo()) },
  ];

  return (
    <div class="rich-editor rounded-xl border border-[#e1e3e5] bg-white overflow-hidden">
      <div class="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-[#e1e3e5] bg-[#fbfbfc]">
        <Show when={!source()}>
          <For each={tools}>
            {(tool) =>
              tool === 'divider' ? (
                <span class="mx-1 h-4 w-px bg-[#e1e3e5]" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  class="p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  classList={{
                    'bg-[#e9eef7] text-[#005bd3]': tool.active?.() ?? false,
                    'text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4]': !(tool.active?.() ?? false),
                  }}
                  title={tool.label}
                  aria-label={tool.label}
                  aria-pressed={tool.active ? tool.active() : undefined}
                  disabled={tool.enabled ? !tool.enabled() : false}
                  // Keep the selection: a toolbar that steals focus formats nothing.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={tool.run}
                >
                  {tool.icon()}
                </button>
              )
            }
          </For>
        </Show>

        <button
          type="button"
          class="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
          classList={{
            'bg-[#e9eef7] text-[#005bd3]': source(),
            'text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4]': !source(),
          }}
          title={source() ? 'Back to the visual editor' : `Edit the ${format() === 'markdown' ? 'markdown' : 'HTML'} directly`}
          onClick={toggleSource}
        >
          <FileCode size={13} />
          {format() === 'markdown' ? 'Markdown' : 'HTML'}
        </button>
      </div>

      <Show when={linking()}>
        <form
          class="flex items-center gap-2 px-2 py-1.5 border-b border-[#e1e3e5] bg-[#fbfbfc]"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <input
            autofocus
            type="url"
            class="h-7 flex-1 rounded-md border border-[#c9cccf] bg-white px-2 text-xs outline-none focus:border-[#005bd3]"
            placeholder="https://… or /a/page/"
            value={linkUrl()}
            onInput={(event) => setLinkUrl(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Escape' && setLinking(false)}
          />
          <button type="submit" class="sam-btn primary">
            {linkUrl().trim() === '' ? 'Remove link' : 'Apply'}
          </button>
          <button type="button" class="sam-btn" onClick={() => setLinking(false)}>
            Cancel
          </button>
        </form>
      </Show>

      {/* Both stay mounted: TipTap owns its element, and remounting it would lose the undo history. */}
      <div ref={element} class="rich-editor-body" classList={{ hidden: source() }} style={{ 'min-height': `${props.minHeight ?? 320}px` }} />

      <Show when={source()}>
        <textarea
          class="block w-full p-4 font-mono text-[13px] leading-relaxed outline-none resize-y border-0 focus:ring-0"
          style={{ 'min-height': `${props.minHeight ?? 320}px` }}
          spellcheck={false}
          value={props.value}
          // Stored exactly as typed — the one path where formatting is yours.
          onInput={(event) => {
            emitted = event.currentTarget.value;
            props.onValue(emitted);
          }}
        />
      </Show>

      <Modal open={choosingImage()} onOpenChange={setChoosingImage} title="Insert an image" wide flushBody>
        <MediaLibrary
          compact
          onChoose={(url) => {
            setChoosingImage(false);
            run((chain) => chain.setImage({ src: url }));
          }}
        />
      </Modal>
    </div>
  );
}
