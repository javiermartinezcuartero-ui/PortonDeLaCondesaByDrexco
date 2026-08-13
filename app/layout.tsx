import React from "react"
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { CookieConsent } from '@/components/cookie-consent'
import { PublicChrome } from '@/components/public-chrome'
import { LocaleProvider } from '@/lib/i18n'
import { LocalBusinessJsonLd } from '@/components/structured-data'
import { brand } from '@/data/site-content'
import './globals.css'

/**
 * Tipografías servidas desde el propio repositorio, no desde `next/font/google`.
 *
 * `next/font/google` descarga los archivos durante el build, y este build llegó a
 * fallar con doce errores de red al no alcanzar `fonts.googleapis.com`. Un build
 * que puede fallar por motivos ajenos al código no es reproducible. Con los
 * archivos versionados el build no sale a Internet, la CSP no necesita autorizar
 * los dominios de Google y el navegador del visitante no le pide nada a un
 * tercero para pintar el texto.
 *
 * Un solo archivo variable por familia cubre todos los pesos que el sitio usa
 * (300–700). Origen, licencias OFL 1.1 y procedimiento de actualización en
 * `app/fonts/README.md`.
 *
 * `display: "swap"` mantiene el comportamiento anterior: el texto se ve de
 * inmediato con la fuente del sistema y se cambia al cargar la definitiva.
 */
const dmSans = localFont({
  src: './fonts/dm-sans-latin-variable.woff2',
  variable: '--font-dm-sans',
  display: 'swap',
  weight: '100 1000',
})

const cormorant = localFont({
  src: './fonts/cormorant-garamond-latin-variable.woff2',
  variable: '--font-cormorant',
  display: 'swap',
  weight: '300 700',
})

const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-latin-variable.woff2',
  variable: '--font-jetbrains',
  display: 'swap',
  weight: '100 800',
})

const siteTitle = 'El Portón de la Condesa — Finca para bodas y celebraciones en Murcia'
const siteDescription =
  'Finca para bodas, comuniones, eventos corporativos y catering en Molina de Segura, Murcia. Salones, jardines, terrazas y gastronomía pensados para acompañarte en cada momento de tu evento.'

export const metadata: Metadata = {
  metadataBase: new URL(brand.website),
  title: {
    default: siteTitle,
    template: '%s — El Portón de la Condesa',
  },
  description: siteDescription,
  keywords: [
    'finca bodas Murcia',
    'salones de bodas Molina de Segura',
    'bodas civiles Murcia',
    'catering Murcia',
    'finca eventos Murcia',
    'comuniones Murcia',
    'eventos corporativos Murcia',
  ],
  authors: [{ name: brand.name }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: brand.website,
    siteName: brand.name,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: '/images/porton/01-boda-civil-jardin.jpg',
        width: 1080,
        height: 810,
        alt: 'Ceremonia civil en el jardín de El Portón de la Condesa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/images/porton/01-boda-civil-jardin.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: [{ url: '/brand/icon-porton-hq.png', type: 'image/png' }],
    apple: '/brand/icon-porton-hq.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${dmSans.variable} ${cormorant.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <LocalBusinessJsonLd />
        <LocaleProvider>
          {/* Enlace de salto al contenido: el primer elemento tabulable de la
              página. Sin él, quien navega con teclado tiene que recorrer la
              cabecera entera —logo, seis enlaces, CTA, idioma y acceso al panel—
              en cada página antes de llegar al contenido.

              Está oculto hasta recibir el foco (`sr-only` + `focus:not-sr-only`),
              que es el patrón habitual: visible solo para quien lo necesita. Va
              dentro de PublicChrome porque en /admin la navegación del panel es lo
              primero y no hay cabecera pública que saltarse. */}
          <PublicChrome>
            <a
              href="#contenido"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-none focus:border focus:border-foreground focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
            >
              Saltar al contenido
            </a>
          </PublicChrome>
          {/* La cabecera, el pie, WhatsApp y el banner de cookies son del sitio
              público: dentro de /admin no se pintan. Ver components/public-chrome.tsx
              (la cabecera es `fixed` y tapaba los controles del panel). */}
          <PublicChrome>
            <Header />
          </PublicChrome>
          {children}
          <PublicChrome>
            <Footer />
            {/* El acceso al panel privado vive ahora en el header (arriba a la
                derecha), no como botón flotante: un único punto de entrada. */}
            <WhatsAppButton />
            <CookieConsent />
          </PublicChrome>
        </LocaleProvider>
      </body>
    </html>
  )
}
