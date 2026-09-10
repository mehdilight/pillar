import Page from '../ui/Page';
import MediaLibrary from '../../components/MediaLibrary';

/** Every image the site has — uploads land in `assets/uploads/`, versioned like any file. */
export default function Media() {
  return (
    <Page title="Media">
      <div class="rounded-ds border border-border bg-surface shadow-ds-sm overflow-hidden flex min-h-[560px]">
        <MediaLibrary compact />
      </div>
    </Page>
  );
}
