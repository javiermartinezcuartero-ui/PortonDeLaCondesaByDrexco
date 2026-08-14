import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DevelopmentEmailProvider } from "@/lib/email/development"
import { ResendEmailProvider } from "@/lib/email/resend"
import { EMAIL_TIMEOUT_MS } from "@/lib/email/config"
import type { EmailMessage } from "@/lib/email/provider"

const API_KEY = "re_clave-de-prueba-que-no-debe-aparecer"

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

/**
 * Resend devuelve el identificador en el **cuerpo** (`{ "id": ... }`), no en una
 * cabecera como el proveedor anterior, así que el doble tiene que servir JSON.
 */
function respondWith(status: number, body: unknown = null) {
  fetchMock.mockResolvedValue(
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: body === null ? {} : { "content-type": "application/json" },
    })
  )
}

describe("ResendEmailProvider — clasificación del resultado", () => {
  it("200 es SENT y guarda el identificador que viene en el cuerpo", async () => {
    respondWith(200, { id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" })

    const result = await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())

    expect(result).toEqual({ status: "SENT", providerMessageId: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" })
  })

  it("un 200 con cuerpo ilegible sigue siendo SENT, sin identificador", async () => {
    // El proveedor ya aceptó el mensaje: que su respuesta cambie de formato no puede
    // convertir un envío correcto en una excepción ni en un fallo registrado.
    fetchMock.mockResolvedValue(new Response("no es json", { status: 200 }))

    const result = await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())

    expect(result).toEqual({ status: "SENT", providerMessageId: undefined })
  })

  it("429 y 5xx son RETRY_PENDING: el mensaje era válido y el problema es del momento", async () => {
    for (const status of [429, 500, 502, 503]) {
      respondWith(status)
      const result = await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())
      expect(result.status).toBe("RETRY_PENDING")
    }
  })

  it("otros 4xx son FAILED: reintentar daría lo mismo", async () => {
    for (const status of [400, 401, 403, 413]) {
      respondWith(status)
      const result = await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())
      expect(result.status).toBe("FAILED")
    }
  })

  it("un timeout es RETRY_PENDING y dice cuánto se esperó", async () => {
    const timeout = new Error("The operation was aborted due to timeout")
    timeout.name = "TimeoutError"
    fetchMock.mockRejectedValue(timeout)

    const result = await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())

    expect(result.status).toBe("RETRY_PENDING")
    if (result.status === "RETRY_PENDING") {
      expect(result.reason).toContain(String(EMAIL_TIMEOUT_MS))
    }
  })

  it("un error de red es RETRY_PENDING", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const result = await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())

    expect(result.status).toBe("RETRY_PENDING")
  })

  it("sin destinatarios no llama al proveedor", async () => {
    const result = await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message({ to: [] }))

    expect(result.status).toBe("SKIPPED_CONFIG")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("ResendEmailProvider — petición enviada", () => {
  it("llama al endpoint de Resend, con timeout y con las dos alternativas del cuerpo", async () => {
    respondWith(200, { id: "abc" })
    await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.resend.com/emails")
    // Sin timeout, un proveedor lento mantendría viva la función serverless.
    expect(init.signal).toBeInstanceOf(AbortSignal)

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.from).toBe("avisos@porton.test")
    expect(body.to).toEqual(["equipo@porton.test"])
    // Las dos alternativas van en el mismo envío: no todos los clientes pintan HTML.
    expect(body.html).toBeTruthy()
    expect(body.text).toBeTruthy()
  })

  it("manda la clave como Bearer y nunca en la URL", async () => {
    respondWith(200, { id: "abc" })
    await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain(API_KEY)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`)
  })

  it("incluye reply_to solo cuando se pasa, y como cadena", async () => {
    // El SDK de Resend expone `replyTo`; su API HTTP espera `reply_to`, y con una
    // dirección plana, no con el objeto `{ email }` que exigía el proveedor anterior.
    respondWith(200, { id: "abc" })
    const provider = new ResendEmailProvider(API_KEY, "avisos@porton.test")

    await provider.send(message())
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).not.toHaveProperty("reply_to")

    await provider.send(message({ replyTo: "ana@example.test" }))
    const withReply = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body))
    expect(withReply.reply_to).toBe("ana@example.test")
  })
})

describe("ResendEmailProvider — nada de secretos en el resultado", () => {
  it("ningún motivo de fallo contiene la clave de API", async () => {
    const provider = new ResendEmailProvider(API_KEY, "avisos@porton.test")

    respondWith(401)
    const failed = await provider.send(message())

    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    const network = await provider.send(message())

    for (const result of [failed, network]) {
      const serialized = JSON.stringify(result)
      expect(serialized).not.toContain(API_KEY)
      expect(serialized).not.toContain("re_")
    }
  })

  it("el resultado no arrastra el cuerpo del mensaje", async () => {
    respondWith(400)
    const result = await new ResendEmailProvider(API_KEY, "avisos@porton.test").send(message())

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
    // RESEND_API_KEY —incluido en producción, donde es opcional—, cada solicitud
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
