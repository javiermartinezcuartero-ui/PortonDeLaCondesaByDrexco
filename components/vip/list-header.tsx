"use client"

import { useLocale } from "@/lib/i18n"

const copy = {
  es: {
    bodas: {
      label: "Bodas reales",
      title: "Historias de parejas que celebraron con nosotros",
      description:
        "Selecciona una boda para ver el caso completo: espacios, decoración, proveedores, minuta y la opinión de la pareja. Te pediremos tu email una sola vez para acceder a toda la biblioteca.",
    },
    catering: {
      label: "Catering",
      title: "Eventos de catering realizados dentro y fuera de la finca",
      description:
        "Selecciona un evento para ver el caso completo: montaje, menú, proveedores y la opinión del cliente. Te pediremos tu email una sola vez para acceder a toda la biblioteca.",
    },
  },
  en: {
    bodas: {
      label: "Real weddings",
      title: "Stories from couples who celebrated with us",
      description:
        "Select a wedding to see the full case: spaces, decoration, suppliers, menu and the couple's review. We'll only ask for your email once to access the whole library.",
    },
    catering: {
      label: "Catering",
      title: "Catering events delivered on and off the venue",
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
      <div className="flex items-center gap-4 mb-6">
        <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">{t.label}</span>
        <div className="w-8 h-px bg-border" />
      </div>
      <h1 className="font-serif text-4xl md:text-6xl font-light text-foreground max-w-3xl">{t.title}</h1>
      <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">{t.description}</p>
    </>
  )
}
