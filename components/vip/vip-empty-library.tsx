"use client"

import { useLocale } from "@/lib/i18n"

const copy = {
  es: {
    bodas: "Todavía no hay bodas publicadas en esta biblioteca. Estamos preparando los primeros casos.",
    catering: "Todavía no hay eventos de catering publicados en esta biblioteca. Estamos preparando los primeros casos.",
  },
  en: {
    bodas: "There are no published weddings in this library yet. We're preparing the first cases.",
    catering: "There are no published catering events in this library yet. We're preparing the first cases.",
  },
} as const

/**
 * Estado vacío de una biblioteca. Es un caso real, no teórico: si el equipo
 * despublica o archiva todo el contenido de una sección, el visitante con
 * acceso debe ver un mensaje, no una cuadrícula vacía.
 */
export function VipEmptyLibrary({ kind }: { kind: "bodas" | "catering" }) {
  const { locale } = useLocale()
  return <p className="mt-16 text-muted-foreground">{copy[locale][kind]}</p>
}
