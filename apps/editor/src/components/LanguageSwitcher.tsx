import { language, setLanguage, t, type Language } from '../i18n';
import CustomSelect from './ui/CustomSelect';

/** Shared preference for the admin and visual editor, without remounting either. */
export default function LanguageSwitcher() {
  return (
    <CustomSelect<Language>
      aria-label={t('Interface language')}
      title={t('Interface language')}
      value={language()}
      onChange={(val) => setLanguage(val)}
      variant="dark"
      size="sm"
      class="w-24"
      options={[
        { value: 'en', label: 'English' },
        { value: 'fr', label: 'Français' },
      ]}
    />
  );
}
