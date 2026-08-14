"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"

/**
 * Cierra la sesión desde el propio servidor, igual que `gate-action.ts` la abre.
 *
 * La versión anterior llamaba a `authClient.signOut()` desde el cliente: un fetch
 * del navegador contra `/api/auth/sign-out`, que Better Auth solo acepta si el
 * origen de la petición coincide con `BETTER_AUTH_URL` (`originCheckMiddleware`,
 * ver node_modules/better-auth/dist/api/middlewares/origin-check.mjs). El botón no
 * comprobaba el resultado, así que si esa comprobación de origen fallaba —típico de
 * un despliegue donde `BETTER_AUTH_URL` no coincide exactamente con el dominio
 * real—, la sesión seguía viva y el botón devolvía al panel como si no hubiera
 * pasado nada: exactamente el síntoma reportado.
 *
 * Llamando aquí a `auth.api.signOut` no hay navegador de por medio: es la misma
 * llamada en el mismo proceso de servidor, así que no hay origen que verificar. El
 * plugin `nextCookies()` de `lib/auth.ts` se encarga de borrar la cookie de sesión
 * desde esta Server Action, tal como ya hace `enterAdminArea` para crearla.
 */
export async function logoutAction(): Promise<{ ok: boolean }> {
  try {
    await auth.api.signOut({ headers: await headers() })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
