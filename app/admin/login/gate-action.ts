"use server"

import { cookies, headers } from "next/headers"
import { ADMIN_THEME_COOKIE, ADMIN_THEME_COOKIE_PATH } from "@/lib/admin-theme"
import { auth } from "@/lib/auth"
import { matchesAdminGatePassword, readAdminGateConfig } from "@/lib/auth/admin-gate"
import { logInfo, logWarn } from "@/lib/observability/log"
import { clientIdentifierFromHeaders, consumeRateLimit, pruneExpiredRateLimits } from "@/lib/security/rate-limit"

/**
 * Entrada al panel con la clave única (ver `lib/auth/admin-gate.ts`).
 *
 * La acción no devuelve nunca por qué ha fallado más allá de tres códigos, y
 * ninguno distingue «clave incorrecta» de «clave correcta pero cuenta mal
 * configurada»: quien está al otro lado no tiene por qué saber si ha acertado.
 */

export type GateResult =
  | { ok: true }
  | { ok: false; code: "invalid" | "rate-limited" | "not-configured"; retryAfterSeconds?: number }

/**
 * Cinco intentos cada diez minutos por IP.
 *
 * Con una clave única y sin usuario, el rate limit es lo único que separa esta
 * puerta de un ataque por diccionario. Better Auth aplica además el suyo sobre el
 * `signIn` que hay debajo, pero ese solo entra en juego cuando la clave ya es
 * correcta, así que no cubre este caso.
 */
const GATE_RULE = { windowSeconds: 600, max: 5 }

export async function enterAdminArea(password: string): Promise<GateResult> {
  const requestHeaders = await headers()
  const config = readAdminGateConfig()

  // Antes que nada el límite: si se comprobara después de la clave, cada intento
  // fallido costaría una comparación y el contador no protegería de nada.
  await pruneExpiredRateLimits().catch(() => undefined)
  const limit = await consumeRateLimit("admin-gate", clientIdentifierFromHeaders(requestHeaders), GATE_RULE)

  if (!limit.allowed) {
    logWarn("admin_gate.rate_limited", { retryAfterSeconds: limit.retryAfterSeconds })
    return { ok: false, code: "rate-limited", retryAfterSeconds: limit.retryAfterSeconds }
  }

  if (!config) {
    // Sin configuración no se entra. Es el lado seguro: un despliegue a medio
    // configurar deja la puerta cerrada, no abierta.
    logWarn("admin_gate.not_configured", {})
    return { ok: false, code: "not-configured" }
  }

  if (!matchesAdminGatePassword(password, config.password)) {
    logWarn("admin_gate.invalid_password", {})
    return { ok: false, code: "invalid" }
  }

  try {
    // La clave era correcta: se abre una sesión real contra la cuenta
    // configurada. El plugin `nextCookies()` de `lib/auth.ts` se encarga de
    // fijar la cookie de sesión desde esta Server Action.
    await auth.api.signInEmail({
      body: { email: config.email, password: config.accountPassword },
      headers: requestHeaders,
    })
  } catch {
    // La clave era buena pero la cuenta no existe o su contraseña no coincide.
    // Se devuelve el mismo código que una clave incorrecta —el detalle está en
    // el registro, no en la respuesta— para no convertir esta pantalla en un
    // oráculo sobre el estado interno del despliegue.
    logWarn("admin_gate.account_sign_in_failed", {})
    return { ok: false, code: "invalid" }
  }

  // El panel arranca en modo día en cada acceso, así que se descarta la preferencia
  // que hubiera quedado de una sesión anterior en este navegador. Es lo que pidió el
  // titular; el modo elegido sigue recordándose mientras se navega por el panel.
  ;(await cookies()).delete({ name: ADMIN_THEME_COOKIE, path: ADMIN_THEME_COOKIE_PATH })

  logInfo("admin_gate.granted", {})
  return { ok: true }
}
