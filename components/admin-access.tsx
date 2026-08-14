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
            "group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            // Verde de marca **sólido** desde el reposo. Pasó por dos versiones
            // que no se veían: `bg-primary/5` con el icono en gris de texto
            // secundario, y después un lavado al 10 % con anillo, que a tamaño
            // real seguía leyéndose como un círculo gris. Es el único punto de
            // entrada al panel en toda la web, así que tiene que distinguirse.
            "bg-primary text-primary-foreground shadow-sm",
            // Al pasar por encima aclara y crece un poco, en vez de invertirse:
            // sobre fondo sólido el cambio de color solo no se percibe.
            "transition-all duration-300 hover:bg-primary/85 hover:scale-105 hover:shadow-md",
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
