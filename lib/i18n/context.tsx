'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { translations, Language, TranslationKeys } from './translations'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationKeys
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const STORAGE_KEY = 'facturio_language'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && (stored === 'fr' || stored === 'en')) {
      setLanguageState(stored)
    } else {
      const browserLang = navigator.language.split('-')[0]
      if (browserLang === 'en') {
        setLanguageState('en')
      }
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }, [])

  const t = translations[language]

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

export function useTranslation() {
  const { t, language } = useI18n()
  return { t, language }
}
