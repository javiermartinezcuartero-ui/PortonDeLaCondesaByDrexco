"use client"

import { useRouter } from "next/navigation"
import { Settings } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { adminAccessContent as adminAccessContentEs } from "@/data/site-content"
import { adminAccessContent as adminAccessContentEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"
import { authClient } from "@/lib/auth-client"

/**
 * Acceso al panel privado desde la cabecera pública.
 *
 * Vive en el header (arriba a la derecha, junto al CTA) y no como botón
 * flotante: es un único punto de entrada en toda la web, no dos.
 *
 * Su visibilidad no es una vulnerabilidad: `/admin/login` es una ruta pública
 * por diseño y todo lo que hay detrás se valida en servidor (ver
 * docs/autenticacion.md). Si ya existe sesión, lleva directamente a `/admin`.
 */
export function AdminAccess({ className }: { className?: string }) {
  const { locale } = useLocale()
  const adminAccessContent = locale === "en" ? adminAccessContentEn : adminAccessContentEs
  const router = useRouter()
  const { data: session } = authClient.useSession()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => router.push(session ? "/admin" : "/admin/login")}
          aria-label={adminAccessContent.tooltip}
          className={cn(
            // 32 px: el acceso al panel es una herramienta interna, no una llamada
            // a la acción del sitio, así que cede protagonismo al logotipo. El
            // volumen y el doble contorno de `.admin-access-fab` son lo que le
            // permite seguir viéndose a este tamaño.
            "group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            // El relleno, los contornos y el volumen están en `.admin-access-fab`
            // (app/globals.css), no aquí: necesitan `color-mix` sobre el token de
            // marca y dos sombras que cambian según la cabecera esté transparente
            // sobre la fotografía o ya opaca. Antes era `bg-primary` plano, y ese
            // verde —`#182605`, casi negro— se empastaba con el hero.
            "admin-access-fab text-primary-foreground",
            "hover:scale-105",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            className
          )}
        >
          <Settings className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{adminAccessContent.tooltip}</TooltipContent>
    </Tooltip>
  )
}
