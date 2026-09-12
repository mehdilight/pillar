import { language, setLanguage, t, type Language } from '../i18n';

/** Shared preference for the admin and visual editor, without remounting either. */
export default function LanguageSwitcher() {
  return (
    <select
      aria-label={t('Interface language')}
      title={t('Interface language')}
      value={language()}
      onChange={(event) => setLanguage(event.currentTarget.value as Language)}
      class="h-8 w-20 cursor-pointer rounded-md border border-[#4a4a4a] bg-[#1a1a1a] px-2 py-0 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <option value="en" lang="en">English</option>
      <option value="fr" lang="fr">Français</option>
    </select>
  );
}
