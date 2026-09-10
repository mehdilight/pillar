import { ImagePicker } from '@pillar/editor';
export { mediaUrl as imagePreviewUrl } from '@pillar/editor';

export default function ImageField(props: { value?: string; onValue: (value: string) => void; label?: string }) {
  return <ImagePicker label={props.label || 'Image when shared'} value={props.value} onValue={(value) => props.onValue(value ?? '')} />;
}
