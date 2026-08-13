import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DevelopmentEmailProvider } from "@/lib/email/development"
import { SendGridEmailProvider } from "@/lib/email/sendgrid"
import { EMAIL_TIMEOUT_MS } from "@/lib/email/config"
import type { EmailMessage } from "@/lib/email/provider"

const API_KEY = "SG.clave-de-prueba-que-no-debe-aparecer"

function message(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    to: ["equipo@porton.test"],
    subject: "Nueva solicitud",
    html: "<p>Contenido con el mensaje de una persona</p>",
    text: "Contenido con el mensaje de una persona",
    ...overrides,
  }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function respondWith(status: number, headers: Record<string, string> = {}) {
  fetchMock.mockResolvedValue(new Response(null, { status, headers }))
}

describe("SendGridEmailProvider — clasificación del resultado", () => {
  it("202 es SENT y guarda el identificador del proveedor", async () => {
    respondWith(202, { "x-message-id": "abc123" })

    const result = await new SendGridEmailProvider(API_KEY, "avisos@porton.test").send(message())

    expect(result).toEqual({ status: "SENT", providerMessageId: "abc123" })
  })

  it("429 y 5xx son RETRY_PENDING: el mensaje era válido y el problema es del momento", async () => {
    for (const status of [429, 500, 502, 503]) {
      respondWith(status)
      const result = await new SendGridEmailProvider(API_KEY, "avisos@porton.test").send(message())
      expect(result.status).toBe("RETRY_PENDING")
    }
  })

  it("otros 4xx son FAILED: reintentar daría lo mismo", async () => {
    for (const status of [400, 401, 403, 413]) {
      respondWith(status)
      const result = await new SendGridEmailProvider(API_KEY, "avisos@porton.test").send(message())
      expect(result.status).toBe("FAILED")
    }
  })

  it("un timeout es RETRY_PENDING y dice cuánto se esperó", async () => {
    const timeout = new Error("The operation was aborted due to timeout")
    timeout.name = "TimeoutError"
    fetchMock.mockRejectedValue(timeout)

    const result = await new SendGridEmailProvider(API_KEY, "avisos@porton.test").send(message())

    expect(result.status).toBe("RETRY_PENDING")
    if (result.status === "RETRY_PENDING") {
      expect(result.reason).toContain(String(EMAIL_TIMEOUT_MS))
    }
  })

  it("un error de red es RETRY_PENDING", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const result = await new SendGridEmailProvider(API_KEY, "avisos@porton.test").send(message())

    expect(result.status).toBe("RETRY_PENDING")
  })

  it("sin destinatarios no llama al proveedor", async () => {
    const result = await new SendGridEmailProvider(API_KEY, "avisos@porton.test").send(message({ to: [] }))

    expect(result.status).toBe("SKIPPED_CONFIG")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("SendGridEmailProvider — petición enviada", () => {
  it("envía con timeout y con el texto plano antes del HTML", async () => {
    respondWith(202)
    await new SendGridEmailProvider(API_KEY, "avisos@porton.test").send(message())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send")
    // Sin timeout, un proveedor lento mantendría viva la función serverless.
    expect(init.signal).toBeInstanceOf(AbortSignal)

    const body = JSON.parse(String(init.body)) as { content: Array<{ type: string }> }
    // El cliente de correo elige la última alternativa que sabe pintar.
    expect(body.content.map((part) => part.type)).toEqual(["text/plain", "text/html"])
  })

  it("incluye replyTo solo cuando se pasa", async () => {
    respondWith(202)
    const provider = new SendGridEmailProvider(API_KEY, "avisos@porton.test")

    await provider.send(message())
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).not.toHaveProperty("reply_to")

    await provider.send(message({ replyTo: "ana@example.test" }))
    const withReply = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body))
    expect(withReply.reply_to).toEqual({ email: "ana@example.test" })
  })
})

describe("SendGridEmailProvider — nada de secretos en el resultado", () => {
  it("ningún motivo de fallo contiene la clave de API", async () => {
    const provider = new SendGridEmailProvider(API_KEY, "avisos@porton.test")

    respondWith(401)
    const failed = await provider.send(message())

    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    const network = await provider.send(message())

    for (const result of [failed, network]) {
      const serialized = JSON.stringify(result)
      expect(serialized).not.toContain(API_KEY)
      expect(serialized).not.toContain("SG.")
    }
  })

  it("el resultado no arrastra el cuerpo del mensaje", async () => {
    respondWith(400)
    const result = await new SendGridEmailProvider(API_KEY, "avisos@porton.test").send(message())

    expect(JSON.stringify(result)).not.toContain("mensaje de una persona")
  })
})

describe("DevelopmentEmailProvider", () => {
  it("no envía nada y lo dice: SKIPPED_CONFIG, no SENT", async () => {
    const result = await new DevelopmentEmailProvider("faltan credenciales").send(message())

    expect(result.status).toBe("SKIPPED_CONFIG")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("no imprime el cuerpo ni la dirección completa", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    await new DevelopmentEmailProvider("faltan credenciales").send(
      message({ to: ["ana.garcia@example.test"], html: "<p>Datos personales de Ana</p>" })
    )

    const logged = JSON.stringify(info.mock.calls)
    expect(logged).not.toContain("Datos personales de Ana")
    expect(logged).not.toContain("ana.garcia@example.test")
    // Sí lo suficiente para saber que se intentó y a qué dominio.
    expect(logged).toContain("example.test")
  })

  it("no imprime el asunto, que lo escribe el visitante", async () => {
    // Regresión. El adaptador registraba `asunto: message.subject`, y el asunto del
    // aviso interno se compone con el texto libre del formulario
    // (`Nueva solicitud: ${request.subject}` en templates.ts). Como
    // `resolveEmailProvider` devuelve este adaptador SIEMPRE que falte
    // SENDGRID_API_KEY —incluido en producción, donde es opcional—, cada solicitud
    // escribía en el log de producción lo que la persona hubiera teclead
    // ("Boda de Ana, llámame al 600...").
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    await new DevelopmentEmailProvider("faltan credenciales").send(
      message({ subject: "Nueva solicitud: boda de Ana Garcia, telefono 600112233" })
    )

    const logged = JSON.stringify(info.mock.calls)
    expect(logged).not.toContain("Ana Garcia")
    expect(logged).not.toContain("600112233")
    expect(logged).not.toContain("boda de Ana")
  })

  it("registra por el log estructurado, no con un console.info a pelo", async () => {
    // El registro estructurado descarta por NOMBRE DE CLAVE cualquier campo que
    // suene a dato personal. Pasar por él es lo que hace que un campo añadido sin
    // pensar dentro de dos fases se omita en lugar de publicarse. Un `console.info`
    // con un objeto no tiene esa red.
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    await new DevelopmentEmailProvider("faltan credenciales").send(message())

    expect(info).toHaveBeenCalledTimes(1)
    const [line] = info.mock.calls[0]
    // Una sola cadena JSON, con la forma del log del proyecto.
    expect(typeof line).toBe("string")
    const entry = JSON.parse(line as string)
    expect(entry.event).toBe("email.skipped_no_provider")
    expect(entry.level).toBe("info")
    expect(entry).not.toHaveProperty("asunto")
    expect(entry).not.toHaveProperty("subject")
  })
})
