// src/store/slices/languageSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import i18n from '@i18n';

export type SupportedLanguage = 'en' | 'de';

interface LanguageState {
  lang: SupportedLanguage;
}

const STORAGE_KEY = 'adv_lang';

const VALID_LANGS: SupportedLanguage[] = ['en', 'de'];

const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const initialLang: SupportedLanguage =
  storedLang && VALID_LANGS.includes(storedLang as SupportedLanguage)
    ? (storedLang as SupportedLanguage)
    : 'de';

const initialState: LanguageState = {
  lang: initialLang,
};

const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    setLanguage(state, action: PayloadAction<SupportedLanguage>) {
      state.lang = action.payload;
      localStorage.setItem(STORAGE_KEY, action.payload);
      i18n.changeLanguage(action.payload);
    },
  },
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer;
