"use server"

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { grantVipAccess } from "@/lib/domain/vip-access"
import { clientIdentifierFromHeaders, consumeRateLimit, pruneExpiredRateLimits } from "@/lib/security/rate-limit"
import { vipGateSchema } from "@/lib/validation/vip-gate"
import { VIP_COOKIE_NAME, vipCookieOptions } from "@/lib/vip/session"

/**
 * Códigos de error en vez de textos: el cliente los traduce al idioma activo
 * (ver components/vip/vip-gate.tsx), así el servidor no decide el idioma.
 */
export type VipGateErrorCode =
  | "invalid-email"
  | "privacy-required"
  | "rate-limited"
  | "persistence-failed"
  | "invalid-request"

export type VipGateActionResult =
  | { ok: true }
  | { ok: false; code: VipGateErrorCode; retryAfterSeconds?: number }

/** 5 intentos cada 10 minutos por IP. Suficiente para un humano que se equivoca. */
const GATE_RATE_LIMIT = { windowSeconds: 600, max: 5 }

/**
 * Concede acceso a las bibliotecas VIP y entrega la cookie de sesión.
 *
 * El acceso es inmediato tras capturar y persistir el email: **no hay magic
 * link en esta versión** (decisión del enunciado). La arquitectura queda
 * preparada para añadir verificación por email más adelante sin rehacer nada:
 * `Verification` ya existe en el esquema y `VipAccessSession` ya es un token
 * hasheado con caducidad, de modo que una futura confirmación por correo solo
 * tendría que crear la sesión al hacer clic en el enlace en vez de aquí.
 */
export async function submitVipGateAction(input: unknown): Promise<VipGateActionResult> {
  const parsed = vipGateSchema.safeParse(input)
  if (!parsed.success) {
    // El honeypot y la casilla de privacidad producen errores distintos para
    // poder dar un mensaje útil a una persona sin decirle nada a un bot.
    const issues = parsed.error.issues
    if (issues.some((issue) => issue.path[0] === "privacyConsent")) {
      return { ok: false, code: "privacy-required" }
    }
    if (issues.some((issue) => issue.path[0] === "email")) {
      return { ok: false, code: "invalid-email" }
    }
    return { ok: false, code: "invalid-request" }
  }

  const values = parsed.data

  const requestHeaders = await headers()
  const limit = await consumeRateLimit(
    "vip-gate",
    clientIdentifierFromHeaders(requestHeaders),
    GATE_RATE_LIMIT
  )
  if (!limit.allowed) {
    return { ok: false, code: "rate-limited", retryAfterSeconds: limit.retryAfterSeconds }
  }

  const sectionSlug = values.section === "REAL_WEDDING" ? "bodas-reales" : "catering"

  try {
    const { token } = await grantVipAccess({
      email: values.email,
      privacyConsent: true,
      marketingConsent: values.marketingConsent,
      section: values.section,
      source: `vip-gate:${sectionSlug}`,
      attribution: values.attribution,
    })

    // La cookie se entrega **solo** después de que la transacción haya
    // confirmado: si `grantVipAccess` lanza, no se llega aquí y no hay acceso.
    ;(await cookies()).set(VIP_COOKIE_NAME, token, vipCookieOptions())
  } catch {
    // No se filtra el motivo real (podría revelar detalles de la base de
    // datos) ni si el email existía ya: el resultado es el mismo en ambos casos.
    return { ok: false, code: "persistence-failed" }
  }

  void pruneExpiredRateLimits()

  // La sesión desbloquea las dos bibliotecas, así que se revalidan ambas.
  revalidatePath("/bodas-reales")
  revalidatePath("/catering")
  if (values.returnPath) revalidatePath(values.returnPath)

  return { ok: true }
}
