import { splitProps, type JSX } from 'solid-js';
import { ChevronDown } from './Icons';

/**
 * A native `<select>` with the dashboard's own chevron.
 *
 * The visual editor strips every select's native arrow (editor.css), and the
 * CMS keeps the browser's — so a bare select looked different in each and,
 * in the editor, like a text box. Every select goes through here instead:
 * the platform's control, one look everywhere. Sizing that the layout needs
 * (`flex-1`, a max width) goes on `wrapperClass`, the box it sits in.
 */
export default function NativeSelect(props: JSX.SelectHTMLAttributes<HTMLSelectElement> & { wrapperClass?: string }) {
  const [own, rest] = splitProps(props, ['class', 'wrapperClass', 'children', 'style']);

  return (
    <div class={`relative flex min-w-0 items-center ${own.wrapperClass ?? ''}`}>
      <select {...rest} class={`w-full cursor-pointer appearance-none pr-8! ${own.class ?? ''}`} style={{ appearance: 'none', 'background-image': 'none' }}>
        {own.children}
      </select>
      <ChevronDown size={14} class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
    </div>
  );
}
