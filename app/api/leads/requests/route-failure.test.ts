import { beforeEach, describe, expect, it, vi } from "vitest"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { MIN_FORM_FILL_MS } from "@/lib/validation/lead-request"

/**
 * Fallo de persistencia, en archivo aparte porque necesita sustituir el módulo
 * de dominio para toda la ejecución (`vi.mock` se aplica al registro de módulos
 * completo). Sin base de datos: aquí solo se comprueba cómo responde el endpoint
 * cuando la escritura no se puede completar.
 */

vi.mock("@/lib/domain/lead-requests", () => ({
  createLeadRequest: vi.fn(async () => {
    throw new Error('relation "lead_request" does not exist — detalle interno')
  }),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(async () => ({ allowed: true })),
  pruneExpiredRateLimits: vi.fn(async () => undefined),
  clientIdentifierFromHeaders: () => "198.18.0.1",
}))

const notifyNewLeadRequest = vi.fn(async () => ({ delivered: false, reason: "not-configured" }))
vi.mock("@/lib/notifications/lead-request-notification", () => ({
  notifyNewLeadRequest: () => notifyNewLeadRequest(),
}))

import { POST } from "./route"

function validPayload() {
  return {
    firstName: "Ana",
    lastName: "García",
    email: "ana@example.test",
    phone: "+34 600 111 222",
    eventType: "WEDDING",
    preferredSpace: "salon-porton",
    subject: "Boda en septiembre",
    message: "Nos gustaría visitar la finca.",
    privacyConsent: true,
    marketingConsent: false,
    policyVersion: PRIVACY_POLICY_VERSION,
    sourcePage: "/",
    sourceForm: "contact-home",
    submissionId: "sub-fallo-de-persistencia",
    formElapsedMs: MIN_FORM_FILL_MS + 1_000,
  }
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  notifyNewLeadRequest.mockClear()
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/leads/requests — fallo de persistencia", () => {
  it("responde 503 con un código genérico y sin filtrar el error interno", async () => {
    const response = await POST(
      new Request("http://localhost:3001/api/leads/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayload()),
      })
    )

    expect(response.status).toBe(503)

    const body = await response.json()
    expect(body).toEqual({ ok: false, code: "persistence-failed" })

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("lead_request")
    expect(serialized).not.toContain("detalle interno")
    // El motivo real sí queda en el log del servidor, para poder diagnosticarlo.
    expect(consoleError).toHaveBeenCalled()
  })

  it("no intenta avisar por email de una solicitud que no se ha guardado", async () => {
    await POST(
      new Request("http://localhost:3001/api/leads/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayload()),
      })
    )

    expect(notifyNewLeadRequest).not.toHaveBeenCalled()
  })
})
