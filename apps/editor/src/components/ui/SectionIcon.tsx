import source from '@phosphor-icons/core/assets/regular/rows.svg?raw';
import type { IconProps } from '../../types';
export const SectionIcon = (props: IconProps) => <svg viewBox="0 0 256 256" fill="currentColor" width={props.size ?? 16} height={props.size ?? 16} class={props.class} aria-hidden="true" innerHTML={source.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')} />;

export default SectionIcon;
