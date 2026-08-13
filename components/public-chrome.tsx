"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

/**
 * Envoltorio de los elementos que solo pertenecen al sitio público: cabecera,
 * pie, botón de WhatsApp y banner de cookies.
 *
 * **Por qué existe.** El layout raíz es el único que puede declarar `<html>`, así
 * que todo lo que ponga se pinta también en `/admin`. Y la cabecera pública es
 * `fixed` con `z-50`: en el panel se superponía a su propia cabecera y dejaba el
 * botón "Cerrar sesión" **materialmente inaccesible** con el ratón en escritorio.
 * Debajo aparecían además el pie con enlaces comerciales y el botón de WhatsApp,
 * que no tienen sentido dentro de un CRM.
 *
 * Se resuelve con `usePathname()` en un componente de cliente en vez de partiendo
 * el proyecto en dos layouts raíz: eso obligaría a mover todas las rutas a grupos
 * y a duplicar `<html>`, tipografías y metadatos, con mucho más riesgo para el
 * sitio público a cambio de lo mismo. `usePathname` está disponible también
 * durante el render en servidor, así que el HTML de `/admin` ya sale sin estos
 * elementos: no hay parpadeo.
 *
 * Lo detectó la prueba E2E del cierre de sesión (escenario 13): el clic no
 * llegaba al botón porque la cabecera pública lo interceptaba.
 */
export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Cubre el panel y su login. `startsWith` en vez de igualdad: son rutas
  // anidadas (/admin/contactos, /admin/contenidos/[id]…).
  if (pathname?.startsWith("/admin")) return null

  return <>{children}</>
}
