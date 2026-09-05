import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, type LanguageKey } from '../locales/translations';

type I18nContextType = {
  language: LanguageKey;
  setLanguage: (lang: LanguageKey) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem('dharohar_language');
    if (saved && translations[saved as LanguageKey]) {
      return saved as LanguageKey;
    }
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem('dharohar_language', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: LanguageKey) => {
    if (translations[lang]) {
      setLanguageState(lang);
    }
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    
    // Helper to get nested value
    const getValue = (obj: any, keyPath: string[]): any => {
      return keyPath.reduce((acc, curr) => (acc && acc[curr] !== undefined ? acc[curr] : undefined), obj);
    };

    let value = getValue(translations[language], keys);
    
    // Fallback to English
    if (value === undefined) {
      value = getValue(translations['en'], keys);
    }

    return value !== undefined ? value : key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
