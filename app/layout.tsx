import React from "react"
import type { Metadata } from 'next'
import { DM_Sans, Cormorant_Garamond, JetBrains_Mono } from 'next/font/google'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { AdminAccess } from '@/components/admin-access'
import { CookieConsent } from '@/components/cookie-consent'
import { LocaleProvider } from '@/lib/i18n'
import { LocalBusinessJsonLd } from '@/components/structured-data'
import { brand } from '@/data/site-content'
import './globals.css'

const dmSans = DM_Sans({ 
  subsets: ["latin"],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600', '700']
});

const cormorant = Cormorant_Garamond({ 
  subsets: ["latin"],
  variable: '--font-cormorant',
  weight: ['300', '400', '500', '600', '700']
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains',
  weight: ['400', '500']
});

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
          <Header />
          {children}
          <Footer />
          <WhatsAppButton />
          <AdminAccess />
          <CookieConsent />
        </LocaleProvider>
      </body>
    </html>
  )
}
