import { prisma } from "@/lib/db"
import { hashRateLimitKey } from "@/lib/security/hash"

/**
 * Rate limit persistente en base de datos, apto para entornos serverless (no
 * depende de estado en memoria compartido entre invocaciones).
 *
 * La clave se guarda **siempre hasheada** con HMAC irreversible: la tabla
 * nunca contiene una IP en claro (ver docs/arquitectura-backend.md §4).
 */

export type RateLimitRule = {
  /** Ventana en segundos. */
  windowSeconds: number
  /** Máximo de solicitudes permitidas dentro de la ventana. */
  max: number
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/**
 * Consume una unidad del contador identificado por `scope` + `identifier`.
 *
 * El incremento es atómico: se hace con un `updateMany` condicionado a
 * `count < max`, de modo que dos peticiones simultáneas no pueden pasar ambas
 * leyendo el mismo valor previo. Si ese update no afecta a ninguna fila, el
 * límite está agotado.
 *
 * @param scope prefijo legible del límite (p. ej. "vip-gate"). No es secreto.
 * @param identifier valor a limitar (p. ej. la IP). Se hashea antes de guardarse.
 */
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const key = `${scope}:${hashRateLimitKey(identifier)}`
  const now = new Date()
  const windowStart = new Date(now.getTime() - rule.windowSeconds * 1000)

  const existing = await prisma.rateLimitCounter.findUnique({ where: { key } })

  // Sin registro, o con la ventana ya vencida: se abre una ventana nueva.
  if (!existing || existing.windowStartedAt <= windowStart) {
    await prisma.rateLimitCounter.upsert({
      where: { key },
      create: { key, count: 1, windowStartedAt: now },
      // El `where` sobre windowStartedAt evita que dos peticiones simultáneas
      // reinicien la ventana una encima de otra: si otra ya la reinició, este
      // update no coincide y se cae al incremento condicional de abajo.
      update: { count: 1, windowStartedAt: now },
    })
    return { allowed: true }
  }

  const consumed = await prisma.rateLimitCounter.updateMany({
    where: { key, count: { lt: rule.max }, windowStartedAt: existing.windowStartedAt },
    data: { count: { increment: 1 } },
  })

  if (consumed.count === 0) {
    const elapsedMs = now.getTime() - existing.windowStartedAt.getTime()
    const retryAfterSeconds = Math.max(1, Math.ceil((rule.windowSeconds * 1000 - elapsedMs) / 1000))
    return { allowed: false, retryAfterSeconds }
  }

  return { allowed: true }
}

/**
 * Borra los contadores cuya ventana venció hace tiempo. No hay cron en el
 * proyecto: se invoca de forma oportunista desde el propio flujo del gate y
 * los fallos se ignoran, porque una purga que falla no debe tumbar la
 * petición de un visitante.
 */
export async function pruneExpiredRateLimits(olderThanSeconds = 3600): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000)
  await prisma.rateLimitCounter
    .deleteMany({ where: { windowStartedAt: { lt: cutoff } } })
    .catch(() => undefined)
}

/**
 * Identificador de cliente a partir de las cabeceras de la petición. Se usa
 * solo como entrada del hash; nunca se persiste ni se registra en claro.
 *
 * Si no hay ninguna cabecera de IP (entorno local, o un proxy que no la
 * reenvía) se devuelve un identificador compartido: es preferible un límite
 * demasiado estricto a no limitar nada.
 */
export function clientIdentifierFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) {
    // El primer valor de la cadena es el cliente original.
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip")?.trim() || headers.get("cf-connecting-ip")?.trim() || "sin-ip-identificable"
}
