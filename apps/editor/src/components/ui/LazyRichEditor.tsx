import { t } from '../../i18n';
import { Suspense, lazy, type ComponentProps } from 'solid-js';

/**
 * The rich editor, loaded on first use.
 *
 * TipTap, ProseMirror and the markdown parser are most of the dashboard's
 * weight — about 600 KB — and most screens never show an editor. This keeps
 * them in their own chunk, fetched the first time an entry or a markdown
 * setting is opened.
 */
const RichEditor = lazy(() => import('./RichEditor'));

type Props = ComponentProps<typeof RichEditor>;

export default function LazyRichEditor(props: Props) {
  return (
    <Suspense
      fallback={
        <div
          class="rounded-xl border border-[#e1e3e5] bg-white text-xs text-gray-400 flex items-center justify-center"
          style={{ 'min-height': `${(props.minHeight ?? 320) + 40}px` }}
        >
          {t("Loading the editor…")} </div>
      }
    >
      <RichEditor {...props} />
    </Suspense>
  );
}
