import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { clientIdentifierFromHeaders, consumeRateLimit, pruneExpiredRateLimits } from "@/lib/security/rate-limit"
import { hashRateLimitKey } from "@/lib/security/hash"
import { itDb } from "@/lib/domain/test-helpers"

const scopes: string[] = []
afterEach(async () => {
  if (scopes.length) {
    await prisma.rateLimitCounter.deleteMany({ where: { OR: scopes.map((scope) => ({ key: { startsWith: scope } })) } })
    scopes.length = 0
  }
})

let counter = 0
function uniqueScope(): string {
  counter += 1
  return `test-rl-${Date.now()}-${counter}`
}

describe("consumeRateLimit", () => {
  itDb("permite hasta el máximo y deniega a partir de ahí", async () => {
    const scope = uniqueScope()
    scopes.push(scope)
    const rule = { windowSeconds: 600, max: 3 }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await consumeRateLimit(scope, "1.2.3.4", rule)
      expect(result.allowed, `intento ${attempt}`).toBe(true)
    }

    const denied = await consumeRateLimit(scope, "1.2.3.4", rule)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.retryAfterSeconds).toBeGreaterThan(0)
      expect(denied.retryAfterSeconds).toBeLessThanOrEqual(600)
    }
  })

  itDb("cuenta por identificador: agotar una IP no bloquea a otra", async () => {
    const scope = uniqueScope()
    scopes.push(scope)
    const rule = { windowSeconds: 600, max: 1 }

    expect((await consumeRateLimit(scope, "10.0.0.1", rule)).allowed).toBe(true)
    expect((await consumeRateLimit(scope, "10.0.0.1", rule)).allowed).toBe(false)
    // Otra IP tiene su propio contador.
    expect((await consumeRateLimit(scope, "10.0.0.2", rule)).allowed).toBe(true)
  })

  itDb("nunca guarda el identificador en claro, solo su hash", async () => {
    const scope = uniqueScope()
    scopes.push(scope)
    const ip = "203.0.113.45"

    await consumeRateLimit(scope, ip, { windowSeconds: 600, max: 5 })

    const rows = await prisma.rateLimitCounter.findMany({ where: { key: { startsWith: scope } } })
    expect(rows).toHaveLength(1)
    expect(rows[0].key).not.toContain(ip)
    expect(rows[0].key).toBe(`${scope}:${hashRateLimitKey(ip)}`)
  })

  itDb("abre una ventana nueva cuando la anterior ha vencido", async () => {
    const scope = uniqueScope()
    scopes.push(scope)
    const rule = { windowSeconds: 600, max: 1 }

    expect((await consumeRateLimit(scope, "198.51.100.7", rule)).allowed).toBe(true)
    expect((await consumeRateLimit(scope, "198.51.100.7", rule)).allowed).toBe(false)

    // Se envejece la ventana a mano en vez de esperar 10 minutos reales.
    await prisma.rateLimitCounter.updateMany({
      where: { key: { startsWith: scope } },
      data: { windowStartedAt: new Date(Date.now() - 601 * 1000) },
    })

    expect((await consumeRateLimit(scope, "198.51.100.7", rule)).allowed).toBe(true)
  })

  itDb("es persistente: el contador vive en base de datos, no en memoria", async () => {
    const scope = uniqueScope()
    scopes.push(scope)

    await consumeRateLimit(scope, "192.0.2.10", { windowSeconds: 600, max: 5 })
    await consumeRateLimit(scope, "192.0.2.10", { windowSeconds: 600, max: 5 })

    const row = await prisma.rateLimitCounter.findFirstOrThrow({ where: { key: { startsWith: scope } } })
    expect(row.count).toBe(2)
  })
})

describe("pruneExpiredRateLimits", () => {
  itDb("borra los contadores antiguos y conserva los recientes", async () => {
    const oldScope = uniqueScope()
    const freshScope = uniqueScope()
    scopes.push(oldScope, freshScope)

    await consumeRateLimit(oldScope, "1.1.1.1", { windowSeconds: 60, max: 5 })
    await consumeRateLimit(freshScope, "1.1.1.1", { windowSeconds: 60, max: 5 })

    await prisma.rateLimitCounter.updateMany({
      where: { key: { startsWith: oldScope } },
      data: { windowStartedAt: new Date(Date.now() - 7200 * 1000) },
    })

    await pruneExpiredRateLimits(3600)

    expect(await prisma.rateLimitCounter.count({ where: { key: { startsWith: oldScope } } })).toBe(0)
    expect(await prisma.rateLimitCounter.count({ where: { key: { startsWith: freshScope } } })).toBe(1)
  })
})

describe("clientIdentifierFromHeaders", () => {
  it.each([
    ["x-forwarded-for con un solo valor", { "x-forwarded-for": "5.5.5.5" }, "5.5.5.5"],
    ["x-forwarded-for con cadena de proxies", { "x-forwarded-for": "5.5.5.5, 10.0.0.1, 10.0.0.2" }, "5.5.5.5"],
    ["x-real-ip", { "x-real-ip": "6.6.6.6" }, "6.6.6.6"],
    ["cf-connecting-ip", { "cf-connecting-ip": "7.7.7.7" }, "7.7.7.7"],
  ])("lee la IP de %s", (_descripcion, headers, expected) => {
    expect(clientIdentifierFromHeaders(new Headers(headers))).toBe(expected)
  })

  it("sin cabeceras usa un identificador compartido (limita en vez de no limitar)", () => {
    expect(clientIdentifierFromHeaders(new Headers())).toBe("sin-ip-identificable")
  })
})

describe("consumeRateLimit — falso positivo por fila desaparecida", () => {
  itDb("si el contador desaparece entre la lectura y el incremento, no rechaza", async () => {
    const scope = uniqueScope()
    scopes.push(scope)
    const identifier = "198.18.0.1"
    const rule = { windowSeconds: 600, max: 1 }
    const key = `${scope}:${hashRateLimitKey(identifier)}`

    // Se agota el límite: la siguiente petición debería rechazarse...
    expect((await consumeRateLimit(scope, identifier, rule)).allowed).toBe(true)
    expect((await consumeRateLimit(scope, identifier, rule)).allowed).toBe(false)

    // ...pero si la fila desaparece (la purga, o una ventana reiniciada en paralelo),
    // el rechazo sería un 429 a alguien que no ha hecho nada.
    await prisma.rateLimitCounter.delete({ where: { key } })
    expect((await consumeRateLimit(scope, identifier, rule)).allowed).toBe(true)

    // Y la ventana nueva vuelve a limitar con normalidad.
    expect((await consumeRateLimit(scope, identifier, rule)).allowed).toBe(false)

    await prisma.rateLimitCounter.deleteMany({ where: { key } })
  })
})
