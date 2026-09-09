import type { IconProps } from '../../types';

/** The generic "a section" mark, matching bastet's editor. */
export function SectionIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <rect x="2.5" y="3.5" width="15" height="4.5" rx="1.5" />
      <rect x="2.5" y="11" width="15" height="5.5" rx="1.5" />
    </svg>
  );
}

export default SectionIcon;
