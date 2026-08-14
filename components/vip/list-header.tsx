"use client"

import { useLocale } from "@/lib/i18n"

const copy = {
  es: {
    bodas: {
      label: "Bodas reales",
      title: "Bodas reales celebradas aquí",
      description:
        "Selecciona una boda para ver el caso completo: espacios, decoración, proveedores, minuta y la opinión de la pareja. Te pediremos tu email una sola vez para acceder a toda la biblioteca.",
    },
    catering: {
      label: "Catering",
      title: "Caterings servidos por nosotros",
      description:
        "Selecciona un evento para ver el caso completo: montaje, menú, proveedores y la opinión del cliente. Te pediremos tu email una sola vez para acceder a toda la biblioteca.",
    },
  },
  en: {
    bodas: {
      label: "Real weddings",
      title: "Real weddings held here",
      description:
        "Select a wedding to see the full case: spaces, decoration, suppliers, menu and the couple's review. We'll only ask for your email once to access the whole library.",
    },
    catering: {
      label: "Catering",
      title: "Catering events we have served",
      description:
        "Select an event to see the full case: set-up, menu, suppliers and the client's review. We'll only ask for your email once to access the whole library.",
    },
  },
} as const

export function VipListHeader({ kind }: { kind: "bodas" | "catering" }) {
  const { locale } = useLocale()
  const t = copy[locale][kind]

  return (
    <>
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="w-8 h-px bg-border" />
        <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">{t.label}</span>
        <div className="w-8 h-px bg-border" />
      </div>
      <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-[-0.03em] text-foreground max-w-3xl mx-auto">{t.title}</h1>
      <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">{t.description}</p>
    </>
  )
}
