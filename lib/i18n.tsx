"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Locale = "es" | "en"

const STORAGE_KEY = "porton-locale"

const LocaleContext = createContext<{ locale: Locale; toggleLocale: () => void }>({
  locale: "es",
  toggleLocale: () => {},
})

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("es")

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "en" || stored === "es") setLocale(stored)
  }, [])

  const toggleLocale = () => {
    setLocale((prev) => {
      const next: Locale = prev === "es" ? "en" : "es"
      window.localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return <LocaleContext.Provider value={{ locale, toggleLocale }}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}
