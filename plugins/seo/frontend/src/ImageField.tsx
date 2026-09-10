import ImagePicker from '../../../../apps/editor/src/components/ui/ImagePicker';
export { mediaUrl as imagePreviewUrl } from '../../../../apps/editor/src/components/MediaLibrary';

export default function ImageField(props: { value?: string; onValue: (value: string) => void; label?: string }) {
  return <ImagePicker label={props.label || 'Image when shared'} value={props.value} onValue={(value) => props.onValue(value ?? '')} />;
}
