import { Show, createSignal, type JSX } from 'solid-js';

interface TooltipProps {
  content: string;
  shortcut?: string;
  children: JSX.Element;
}

export default function Tooltip(props: TooltipProps) {
  const [shown, setShown] = createSignal(false);

  return (
    <div
      class="relative inline-flex"
      onMouseEnter={() => setShown(true)}
      onMouseLeave={() => setShown(false)}
    >
      {props.children}
      <Show when={shown()}>
        <div class="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-[60] whitespace-nowrap rounded-md bg-[#1a1a1a] text-white text-[11px] font-medium px-2 py-1 shadow-lg pointer-events-none border border-[#2c2d30]">
          {props.content}
          <Show when={props.shortcut}>
            <span class="ml-1.5 text-gray-400 font-mono">{props.shortcut}</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
