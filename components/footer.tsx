"use client"

import Link from "next/link"
import Image from "next/image"
import { InstagramIcon } from "@/components/icons/instagram-icon"
import { FacebookIcon } from "@/components/icons/facebook-icon"
import { BodasNetIcon } from "@/components/icons/bodas-net-icon"
import { brand, navigation as navigationEs, footerContent as footerContentEs } from "@/data/site-content"
import { navigation as navigationEn, footerContent as footerContentEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"

const footerCopy = {
  es: {
    tagline: (city: string, province: string) => `Finca para bodas y celebraciones en ${city}, ${province}.`,
    navigation: "Navegación",
    legal: "Legal",
    contact: "Contacto",
    rights: "Todos los derechos reservados.",
    backToTop: "Volver arriba",
    developedBy: "Desarrollado por",
  },
  en: {
    tagline: (city: string, province: string) => `A wedding and celebration venue in ${city}, ${province}.`,
    navigation: "Navigation",
    legal: "Legal",
    contact: "Contact",
    rights: "All rights reserved.",
    backToTop: "Back to top",
    developedBy: "Developed by",
  },
} as const

export function Footer() {
  const { locale } = useLocale()
  const navigation = locale === "en" ? navigationEn : navigationEs
  const footerContent = locale === "en" ? footerContentEn : footerContentEs
  const t = footerCopy[locale]
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative py-16 md:py-24 border-t border-border">
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20">
          {/* Logo & Tagline */}
          <div className="lg:col-span-4 space-y-6">
            <Link href="/" className="inline-block">
              <Image
                src={brand.logo.transparent}
                alt={brand.name}
                width={340}
                height={88}
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {t.tagline(brand.address.city, brand.address.province)}
            </p>
          </div>

          {/* Navigation */}
          <div className="lg:col-span-2">
            <h4 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">
              {t.navigation}
            </h4>
            <nav className="space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-sm text-foreground/70 hover:text-foreground transition-colors duration-300"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div className="lg:col-span-2">
            <h4 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">
              {t.legal}
            </h4>
            <nav className="space-y-4">
              {footerContent.legalLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-sm text-foreground/70 hover:text-foreground transition-colors duration-300"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Contact Quick */}
          <div className="lg:col-span-4">
            <h4 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">
              {t.contact}
            </h4>
            <div className="space-y-4">
              <p className="text-sm text-foreground/70">
                {brand.address.line}
                <br />
                {brand.address.postalCode} {brand.address.city}, {brand.address.province}
              </p>
              <p className="text-sm">
                <a
                  href={`mailto:${brand.email}`}
                  className="text-foreground hover:text-accent transition-colors duration-300"
                >
                  {brand.email}
                </a>
              </p>
              <p className="text-sm">
                <a
                  href={`tel:${brand.phone.replace(/\s/g, "")}`}
                  className="text-foreground/70 hover:text-foreground transition-colors duration-300"
                >
                  {brand.phone}
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs text-muted-foreground">
            © {currentYear} {brand.name}. {t.rights}
          </p>

          {/* Social Links */}
          <div className="flex items-center gap-3">
            <a
              href={brand.social.instagram.url}
              aria-label="Instagram"
              title="Instagram"
              className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors duration-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
            <a
              href={brand.social.facebook.url}
              aria-label="Facebook"
              title="Facebook"
              className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors duration-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FacebookIcon className="h-5 w-5" />
            </a>
            <a
              href={brand.social.bodasNet.url}
              aria-label={brand.social.bodasNet.label}
              title={brand.social.bodasNet.label}
              className="flex items-center justify-center h-8 w-8 rounded-md overflow-hidden"
              target="_blank"
              rel="noopener noreferrer"
            >
              <BodasNetIcon className="h-5 w-5" />
            </a>
          </div>

          {/* Back to Top */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group flex items-center gap-2 text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            <span>{t.backToTop}</span>
            <svg
              className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>

        {/* Large Decorative Text */}
        <div className="mt-16 md:mt-24">
          <p className="font-serif text-[9vw] sm:text-[7vw] md:text-[5vw] lg:text-[3.4vw] font-light tracking-[-0.02em] text-foreground/[0.04] leading-[1.05]">
            {footerContent.decorativePhrase}
          </p>
        </div>

        {/* Credit */}
        <div className="mt-8 flex justify-center md:justify-end">
          <a
            href={brand.credits.url}
            target="_blank"
            rel="noopener noreferrer"
            title={brand.credits.name}
            aria-label={`Web creada por ${brand.credits.name}`}
            className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity duration-300"
          >
            <span className="text-xs text-muted-foreground">{t.developedBy}</span>
            <Image
              src="/brand/solucionesbonicas-logo.png"
              alt={brand.credits.name}
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          </a>
        </div>
      </div>
    </footer>
  )
}
