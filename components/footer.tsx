"use client"

import Link from "next/link"
import Image from "next/image"
import { Mail, MapPin, Phone } from "lucide-react"
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
    // Compactado a petición del titular: el pie ocupaba casi una pantalla entera
    // en escritorio. Se recortan los espaciados verticales —el relleno de la
    // sección, la separación entre columnas y el aire entre enlaces— sin quitar
    // ningún contenido ni reducir el área de pulsación de los enlaces, que en
    // móvil es lo que hace usable un pie.
    <footer className="relative py-12 md:py-16 border-t border-border">
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Logo & Tagline */}
          <div className="lg:col-span-3 space-y-4">
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
          {/*
            `aria-labelledby` en lugar de `aria-label`: el nombre sale del encabezado
            que ya está en pantalla, así que se traduce con el resto de la interfaz y
            no hay que mantener el texto en dos idiomas ni en dos sitios.
          */}
          <div className="lg:col-span-3">
            <h4 id="footer-nav-heading" className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
              {t.navigation}
            </h4>
            <nav aria-labelledby="footer-nav-heading" className="grid grid-cols-2 gap-x-6 gap-y-2.5">
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
            <h4 id="footer-legal-heading" className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
              {t.legal}
            </h4>
            <nav aria-labelledby="footer-legal-heading" className="space-y-2.5">
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
            <h4 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
              {t.contact}
            </h4>
            {/*
              Cada dato de contacto lleva delante su icono. Van con `aria-hidden`
              y `shrink-0`: son una ayuda visual para localizar el dato de un
              vistazo, no información nueva. Un lector de pantalla que los
              anunciara diría «imagen, sobre, correo@…», que es peor que no
              tenerlos. El texto que hay al lado ya nombra cada cosa.

              El icono de la dirección se alinea arriba (`mt-0.5`, no `items-center`)
              porque la dirección ocupa dos líneas y centrarlo lo dejaría flotando
              entre ambas.
            */}
            <div className="space-y-3">
              <p className="flex items-start gap-2.5 text-sm text-foreground/70">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-accent" aria-hidden />
                <span>
                  {brand.address.line}
                  <br />
                  {brand.address.postalCode} {brand.address.city}, {brand.address.province}
                </span>
              </p>
              <p className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <a
                  href={`mailto:${brand.email}`}
                  className="text-foreground hover:text-accent transition-colors duration-300"
                >
                  {brand.email}
                </a>
              </p>
              <p className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-accent" aria-hidden />
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

        {/* Barra inferior.
            Sin el filete que la separaba del bloque de arriba: el pie ya está dentro
            de una sección delimitada por su propio borde superior, así que la línea
            intermedia partía en dos algo que se lee como una sola pieza. La
            separación la da ahora el espacio.

            El crédito de desarrollo estaba en una cuarta fila propia y se integra
            aquí, que es lo que de verdad compacta el pie: cuatro filas pasan a dos. */}
        <div className="mt-8 flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex flex-col items-center gap-1.5 md:flex-row md:gap-4">
            <p className="text-xs text-muted-foreground">
              © {currentYear} {brand.name}. {t.rights}
            </p>
            <a
              href={brand.credits.url}
              target="_blank"
              rel="noopener noreferrer"
              title={brand.credits.name}
              aria-label={`Web creada por ${brand.credits.name}`}
              className="flex items-center gap-1.5 opacity-70 transition-opacity duration-300 hover:opacity-100"
            >
              <span className="text-xs text-muted-foreground">{t.developedBy}</span>
              <Image
                src="/brand/solucionesbonicas-logo.png"
                alt={brand.credits.name}
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
              />
            </a>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-3">
            <a
              href={brand.social.instagram.url}
              aria-label="Instagram"
              title="Instagram"
              className="flex items-center justify-center h-8 w-8 opacity-80 hover:opacity-100 transition-opacity duration-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
            <a
              href={brand.social.facebook.url}
              aria-label="Facebook"
              title="Facebook"
              className="flex items-center justify-center h-8 w-8 opacity-80 hover:opacity-100 transition-opacity duration-300"
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
      </div>
    </footer>
  )
}
