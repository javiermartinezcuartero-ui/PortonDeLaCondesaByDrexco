"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { brand, navigation as navigationEs, headerCta as headerCtaEs } from "@/data/site-content"
import { navigation as navigationEn, headerCta as headerCtaEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"
import { AdminAccess } from "@/components/admin-access"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { locale, toggleLocale } = useLocale()
  const navigation = locale === "en" ? navigationEn : navigationEs
  const headerCta = locale === "en" ? headerCtaEn : headerCtaEs

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out",
        isScrolled
          ? "bg-background/95 backdrop-blur-sm border-b border-border"
          : "bg-transparent"
      )}
    >
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="flex items-center justify-between h-20 md:h-24">
          {/* Logo */}
          <Link
            href="/"
            className="relative group shrink-0"
            aria-label={brand.name}
          >
            <span
              role="img"
              aria-label={brand.name}
              className="block h-9 md:h-11 bg-primary"
              style={{
                aspectRatio: "3344 / 852",
                WebkitMaskImage: `url(${brand.logo.transparent})`,
                maskImage: `url(${brand.logo.transparent})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskPosition: "left center",
                maskPosition: "left center",
              }}
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-5 2xl:gap-8">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="relative group shrink-0 whitespace-nowrap text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-accent transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          {/* Language toggle */}
          <label className="hidden xl:flex items-center gap-2 shrink-0 cursor-pointer select-none">
            <span className={cn("text-xs tracking-[0.1em]", locale === "es" ? "text-foreground" : "text-muted-foreground")}>ES</span>
            <span className="relative inline-flex h-4 w-8 items-center rounded-full bg-border transition-colors">
              <input
                type="checkbox"
                checked={locale === "en"}
                onChange={toggleLocale}
                className="peer sr-only"
                aria-label="Switch language / Cambiar idioma"
              />
              <span
                className={cn(
                  "absolute left-0.5 h-3 w-3 rounded-full bg-primary transition-transform duration-300",
                  locale === "en" && "translate-x-4"
                )}
              />
            </span>
            <span className={cn("text-xs tracking-[0.1em]", locale === "en" ? "text-foreground" : "text-muted-foreground")}>EN</span>
          </label>

          {/* Acceso al panel privado. El CTA de contacto se retiró de la barra
              superior; sigue disponible en el menú móvil y en la home. */}
          <div className="hidden xl:flex items-center shrink-0">
            <AdminAccess />
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="xl:hidden relative w-10 h-10 flex items-center justify-center"
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMobileMenuOpen}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className={cn(
                  "w-6 h-px bg-foreground transition-all duration-300",
                  isMobileMenuOpen && "rotate-45 translate-y-[4px]"
                )}
              />
              <span
                className={cn(
                  "w-6 h-px bg-foreground transition-all duration-300",
                  isMobileMenuOpen && "-rotate-45 -translate-y-[3px]"
                )}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "xl:hidden fixed inset-0 bg-background transition-all duration-500 ease-out",
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ top: isScrolled ? "81px" : "80px" }}
      >
        <nav className="flex flex-col items-center justify-center h-full gap-8 pb-20">
          {navigation.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-2xl font-serif tracking-[0.1em] text-foreground hover:text-accent transition-colors duration-300"
              style={{
                transitionDelay: isMobileMenuOpen ? `${index * 50}ms` : "0ms",
                transform: isMobileMenuOpen ? "translateY(0)" : "translateY(20px)",
                opacity: isMobileMenuOpen ? 1 : 0,
                transition: "all 0.5s ease-out"
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={headerCta.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className="mt-8 px-8 py-4 text-sm tracking-[0.1em] uppercase text-primary-foreground bg-primary"
            style={{
              transitionDelay: isMobileMenuOpen ? `${navigation.length * 50}ms` : "0ms",
              transform: isMobileMenuOpen ? "translateY(0)" : "translateY(20px)",
              opacity: isMobileMenuOpen ? 1 : 0,
              transition: "all 0.5s ease-out"
            }}
          >
            {headerCta.label}
          </Link>
          <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
            <span className={cn("text-xs tracking-[0.1em]", locale === "es" ? "text-foreground" : "text-muted-foreground")}>ES</span>
            <span className="relative inline-flex h-4 w-8 items-center rounded-full bg-border">
              <input type="checkbox" checked={locale === "en"} onChange={toggleLocale} className="peer sr-only" aria-label="Switch language / Cambiar idioma" />
              <span className={cn("absolute left-0.5 h-3 w-3 rounded-full bg-primary transition-transform duration-300", locale === "en" && "translate-x-4")} />
            </span>
            <span className={cn("text-xs tracking-[0.1em]", locale === "en" ? "text-foreground" : "text-muted-foreground")}>EN</span>
          </label>

          {/* El mismo acceso, para que en móvil no quede fuera de alcance */}
          <div onClick={() => setIsMobileMenuOpen(false)}>
            <AdminAccess />
          </div>
        </nav>
      </div>
    </header>
  )
}
