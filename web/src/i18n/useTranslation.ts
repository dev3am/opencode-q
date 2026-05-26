import { createContext, useContext } from "react"
import { translations, type Lang } from "./translations"

export interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string) => string
}

export const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key: string) => translations.en[key] || key,
})

export function useTranslation() {
  return useContext(I18nContext)
}

export function detectLang(): Lang {
  const saved = localStorage.getItem("opencode-q-lang") as Lang | null
  if (saved && (saved === "ko" || saved === "en" || saved === "ja" || saved === "zh")) return saved
  return "en"
}
