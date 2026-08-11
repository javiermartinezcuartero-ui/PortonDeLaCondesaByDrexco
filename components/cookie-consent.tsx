"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { cookieConsentContent as cookieConsentContentEs } from "@/data/site-content"
import { cookieConsentContent as cookieConsentContentEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"

export function CookieConsent() {
  const { locale } = useLocale()
  const cookieConsentContent = locale === "en" ? { ...cookieConsentContentEn, storageKey: cookieConsentContentEs.storageKey } : cookieConsentContentEs
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(cookieConsentContent.storageKey)
    if (!stored) {
      setVisible(true)
    }
  }, [])

  // Los botones flotantes (WhatsApp / Zona Admin) se desplazan mientras el
  // banner esté visible para que no queden bloqueados detrás de él.
  useEffect(() => {
    document.body.classList.toggle("cookie-banner-visible", visible)
    return () => document.body.classList.remove("cookie-banner-visible")
  }, [visible])

  const handleChoice = (choice: "accepted" | "rejected") => {
    window.localStorage.setItem(cookieConsentContent.storageKey, choice)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1800px] px-6 py-4 md:px-12 lg:px-20 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed flex-1">
          {cookieConsentContent.message}{" "}
          <Link href={cookieConsentContent.policyLink.href} className="underline hover:text-foreground transition-colors duration-300">
            {cookieConsentContent.policyLink.label}
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleChoice("rejected")}
            className="text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            {cookieConsentContent.rejectLabel}
          </button>
          <button
            type="button"
            onClick={() => handleChoice("accepted")}
            className="px-4 py-2 text-xs tracking-[0.1em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300"
          >
            {cookieConsentContent.acceptLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
