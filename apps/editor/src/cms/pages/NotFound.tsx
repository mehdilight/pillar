import { t } from '../../i18n';
import { A } from '@solidjs/router';
import Page from '../ui/Page';
import { Empty, buttonClass } from '../ui/ds';

export default function NotFound() {
  return (
    <Page title={t("Not found")}>
      <Empty
        title={t("There is nothing at this address.")}
        description={t("The page may have been renamed, or the collection removed.")}
        action={
          <A href="/" class={buttonClass('primary', 'sm')}>
            {t("Back to the overview")} </A>
        }
      />
    </Page>
  );
}
