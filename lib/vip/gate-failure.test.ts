import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * "No desbloquees si la persistencia falla". Se comprueba forzando el fallo en
 * la capa de dominio y verificando que el gate **no** entrega cookie.
 *
 * Va en un archivo aparte de gate-action.test.ts porque necesita mockear
 * `grantVipAccess`, y los mocks de módulo son por archivo en Vitest: mezclarlo
 * dejaría el resto de los tests operando contra un doble en vez de la
 * implementación real.
 */

const grantVipAccess = vi.fn()
vi.mock("@/lib/domain/vip-access", () => ({
  grantVipAccess: (...args: unknown[]) => grantVipAccess(...args),
  VIP_SESSION_TTL_MS: 1000 * 60 * 60 * 24 * 30,
}))

const consumeRateLimit = vi.fn(async () => ({ allowed: true as const }))
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimit(...(args as [])),
  pruneExpiredRateLimits: async () => undefined,
  clientIdentifierFromHeaders: () => "1.2.3.4",
}))

const cookieSet = vi.fn()
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: cookieSet }),
}))

const revalidatePath = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }))

import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { submitVipGateAction } from "@/lib/vip/gate-action"

const validInput = {
  email: "persona@example.test",
  privacyConsent: true,
  policyVersion: PRIVACY_POLICY_VERSION,
  marketingConsent: false,
  section: "REAL_WEDDING" as const,
  returnPath: "/bodas-reales",
}

beforeEach(() => {
  grantVipAccess.mockReset()
  cookieSet.mockClear()
  revalidatePath.mockClear()
  consumeRateLimit.mockClear()
})

describe("fallo de persistencia", () => {
  it("un error de base de datos devuelve error y NO entrega la cookie", async () => {
    grantVipAccess.mockRejectedValue(new Error("connection terminated unexpectedly"))

    const result = await submitVipGateAction(validInput)

    expect(result).toEqual({ ok: false, code: "persistence-failed" })
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("no filtra el motivo real del fallo al visitante", async () => {
    grantVipAccess.mockRejectedValue(new Error('relation "vip_access_session" does not exist'))

    const result = await submitVipGateAction(validInput)

    // El mensaje interno no debe aparecer en la respuesta.
    expect(JSON.stringify(result)).not.toMatch(/relation|does not exist/i)
  })

  it("tras un fallo no revalida las rutas (no hay nada nuevo que mostrar)", async () => {
    grantVipAccess.mockRejectedValue(new Error("timeout"))

    await submitVipGateAction(validInput)

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("cuando la persistencia funciona, sí entrega la cookie", async () => {
    grantVipAccess.mockResolvedValue({
      token: "token-de-prueba",
      lead: { id: "lead-1" },
      expiresAt: new Date(Date.now() + 1000),
    })

    const result = await submitVipGateAction(validInput)

    expect(result).toEqual({ ok: true })
    expect(cookieSet).toHaveBeenCalledWith("porton_vip_access", "token-de-prueba", expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
    }))
  })
})

describe("rate limit agotado", () => {
  it("no llega a tocar la base de datos", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 } as never)

    const result = await submitVipGateAction(validInput)

    expect(result).toEqual({ ok: false, code: "rate-limited", retryAfterSeconds: 42 })
    expect(grantVipAccess).not.toHaveBeenCalled()
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it("no se consulta el rate limit si el payload ya es inválido", async () => {
    const result = await submitVipGateAction({ ...validInput, email: "no-es-email" })

    expect(result).toEqual({ ok: false, code: "invalid-email" })
    expect(consumeRateLimit).not.toHaveBeenCalled()
  })
})
