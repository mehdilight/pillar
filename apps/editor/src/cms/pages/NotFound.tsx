import { A } from '@solidjs/router';
import Page from '../ui/Page';
import { Empty, buttonClass } from '../ui/ds';

export default function NotFound() {
  return (
    <Page title="Not found">
      <Empty
        title="There is nothing at this address."
        description="The page may have been renamed, or the collection removed."
        action={
          <A href="/" class={buttonClass('primary', 'sm')}>
            Back to the overview
          </A>
        }
      />
    </Page>
  );
}
