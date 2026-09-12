import { createTranslator } from '@pillar/editor';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const t = createTranslator('plugin.seo', { en, fr });
