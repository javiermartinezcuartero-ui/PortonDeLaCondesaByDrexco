import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"
import type { Lead } from "@prisma/client"
import { verifyVipAccessSession } from "@/lib/domain/vip-sessions"

/**
 * Sesión de acceso a las bibliotecas VIP, resuelta **en servidor**.
 *
 * La cookie contiene únicamente el token aleatorio: ni el email, ni el id del
 * Lead, ni ningún dato personal. En base de datos solo vive su HMAC
 * (`VipAccessSession.tokenHash`), así que un volcado de la tabla no permite
 * reconstruir tokens válidos.
 */

export const VIP_COOKIE_NAME = "porton_vip_access"

/** 30 días, igual que el TTL por defecto de `VipAccessSession`. */
export const VIP_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/**
 * `secure` solo en producción (o si la app se sirve por https): en desarrollo
 * sobre http una cookie Secure no se guardaría y el gate sería inusable.
 * `sameSite: "lax"` y no "strict" para que el acceso sobreviva a llegar desde
 * un enlace externo (redes sociales, campañas), que es el caso de uso real.
 */
export function vipCookieOptions() {
  const isHttps = process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || isHttps,
    sameSite: "lax" as const,
    path: "/",
    maxAge: VIP_COOKIE_MAX_AGE_SECONDS,
  }
}

/**
 * Lead con acceso válido, o `null`. Cacheado por petición con `cache()` de
 * React: varias llamadas dentro del mismo render (página, layout, metadata)
 * comparten una única verificación y una única actualización de `lastUsedAt`.
 *
 * Un token inexistente, caducado o revocado devuelve `null`, que es lo que
 * hace aparecer el gate: no hay ninguna vía por la que un token inválido
 * conceda acceso.
 */
export const getVipLead = cache(async (): Promise<Lead | null> => {
  const token = (await cookies()).get(VIP_COOKIE_NAME)?.value
  if (!token) return null

  try {
    return await verifyVipAccessSession(token)
  } catch {
    // Un fallo de base de datos no debe conceder acceso: se trata como
    // "sin sesión" y el visitante vuelve a ver el gate.
    return null
  }
})

/** `true` si hay acceso válido. Azúcar sobre `getVipLead` (comparte su caché). */
export async function hasVipAccess(): Promise<boolean> {
  return (await getVipLead()) !== null
}
