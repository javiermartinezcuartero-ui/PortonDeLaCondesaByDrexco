import { afterEach, describe, expect, it, vi } from "vitest"
import { ERROR_CODES, logError, logInfo, resolveRequestId, sanitizeLogFields } from "@/lib/observability/log"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("sanitizeLogFields", () => {
  it("omite el valor de cualquier clave con nombre de dato personal", () => {
    const safe = sanitizeLogFields({
      email: "ana@example.test",
      phone: "+34600112233",
      nombre: "Ana",
      apellidos: "García",
      message: "texto libre",
      mensaje: "texto libre",
      subject: "Boda en septiembre",
      nota: "opinión interna",
      ip: "198.18.0.1",
      userAgent: "Mozilla/5.0",
      token: "abc",
      password: "x",
      apiKey: "SG.x",
      cookie: "sesion=1",
    })

    for (const value of Object.values(safe)) {
      expect(value).toBe("[omitido]")
    }
    const serialized = JSON.stringify(safe)
    expect(serialized).not.toContain("ana@example.test")
    expect(serialized).not.toContain("+34600112233")
    expect(serialized).not.toContain("Boda en septiembre")
    expect(serialized).not.toContain("SG.x")
  })

  it("marca la clave como omitida en vez de borrarla", () => {
    // Un hueco silencioso esconde que había un dato; "[omitido]" dice que se
    // decidió no guardarlo.
    expect(sanitizeLogFields({ email: "x@y.z" })).toEqual({ email: "[omitido]" })
  })

  it("conserva los campos operativos", () => {
    const safe = sanitizeLogFields({ requestId: "abc-123", sourceForm: "contact-home", status: 503, ok: false })
    expect(safe).toEqual({ requestId: "abc-123", sourceForm: "contact-home", status: 503, ok: false })
  })

  it("no serializa objetos ni arrays: es donde se cuelan los cuerpos enteros", () => {
    const safe = sanitizeLogFields({ payload: { email: "ana@example.test" }, fields: ["email", "phone"] })
    expect(safe.payload).toBe("[objeto]")
    expect(safe.fields).toBe("[array:2]")
    expect(JSON.stringify(safe)).not.toContain("ana@example.test")
  })

  it("recorta las cadenas largas", () => {
    const safe = sanitizeLogFields({ detalle: "x".repeat(1_000) })
    expect(String(safe.detalle).length).toBe(200)
  })
})

describe("resolveRequestId", () => {
  it("reutiliza el identificador de la plataforma si existe", () => {
    expect(resolveRequestId(new Headers({ "x-request-id": "req-1" }))).toBe("req-1")
    expect(resolveRequestId(new Headers({ "x-vercel-id": "ver-1" }))).toBe("ver-1")
  })

  it("genera uno cuando no llega ninguno", () => {
    const first = resolveRequestId(new Headers())
    const second = resolveRequestId(new Headers())
    expect(first).not.toBe(second)
    expect(first.length).toBeGreaterThan(10)
  })

  it("acota un identificador desmesurado que llegue de fuera", () => {
    const long = resolveRequestId(new Headers({ "x-request-id": "a".repeat(5_000) }))
    expect(long.length).toBe(100)
  })
})

describe("logError", () => {
  it("registra código y motivo, nunca el stack", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const thrown = new Error("relation \"lead\" does not exist")

    logError("leads.persistence_failed", { code: ERROR_CODES.persistence, requestId: "req-1", error: thrown })

    const line = String(error.mock.calls[0][0])
    const entry = JSON.parse(line)
    expect(entry.code).toBe("E_PERSISTENCE")
    expect(entry.requestId).toBe("req-1")
    expect(entry.reason).toContain("does not exist")
    // Un stack revela rutas del sistema y versiones de dependencias.
    expect(line).not.toContain("at ")
    expect(entry.stack).toBeUndefined()
  })

  it("emite JSON de una línea, para poder buscarlo en un agregador", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    logInfo("algo.paso", { requestId: "req-2" })

    const line = String(info.mock.calls[0][0])
    expect(() => JSON.parse(line)).not.toThrow()
    expect(line.includes("\n")).toBe(false)
    expect(JSON.parse(line).level).toBe("info")
  })

  it("no filtra datos personales aunque se pasen por error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    logError("algo.fallo", {
      code: ERROR_CODES.unexpected,
      requestId: "req-3",
      email: "ana@example.test",
      mensaje: "soy Ana y mi teléfono es 600112233",
    })

    const line = String(error.mock.calls[0][0])
    expect(line).not.toContain("ana@example.test")
    expect(line).not.toContain("600112233")
  })
})
