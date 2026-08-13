import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { hasTransport, maskEmail, maskEmails, readEmailConfig } from "@/lib/email/config"
import { DevelopmentEmailProvider } from "@/lib/email/development"
import { SendGridEmailProvider } from "@/lib/email/sendgrid"
import { resolveEmailProvider } from "@/lib/email"

const VARS = [
  "SENDGRID_API_KEY",
  "LEADS_FROM_EMAIL",
  "LEADS_NOTIFICATION_TO",
  "SEND_LEAD_ACKNOWLEDGEMENT",
  "NEXT_PUBLIC_SITE_URL",
] as const

const original: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const name of VARS) {
    original[name] = process.env[name]
    delete process.env[name]
  }
})

afterEach(() => {
  for (const name of VARS) {
    if (original[name] === undefined) delete process.env[name]
    else process.env[name] = original[name]
  }
})

describe("maskEmail", () => {
  it("conserva el dominio y oculta la parte local", () => {
    // El dominio sirve para diagnosticar ("se intentó a un gmail, no al buzón
    // interno"); la identidad de la persona no hace falta para eso.
    expect(maskEmail("ana.garcia@example.test")).toBe("a***a@example.test")
  })

  it("oculta por completo una parte local corta, donde no hay nada que revelar a medias", () => {
    expect(maskEmail("an@example.test")).toBe("***@example.test")
    expect(maskEmail("a@example.test")).toBe("***@example.test")
  })

  it("no filtra nada si la dirección es inválida", () => {
    expect(maskEmail("sin-arroba")).toBe("***")
    expect(maskEmail("@solo-dominio")).toBe("***")
    expect(maskEmail("local@")).toBe("***")
  })

  it("nunca devuelve la dirección completa", () => {
    for (const address of ["ana.garcia@example.test", "equipo@porton.test", "x@y.z"]) {
      expect(maskEmail(address)).not.toBe(address)
    }
  })

  it("enmascara listas conservando el orden", () => {
    expect(maskEmails(["ana.garcia@example.test", "equipo@porton.test"])).toBe(
      "a***a@example.test, e***o@porton.test"
    )
  })
})

describe("readEmailConfig", () => {
  it("sin variables deja todo apagado y cae a localhost", () => {
    const config = readEmailConfig()
    expect(config.apiKey).toBeUndefined()
    expect(config.from).toBeUndefined()
    expect(config.notificationTo).toEqual([])
    expect(config.sendAcknowledgement).toBe(false)
    expect(config.siteUrl).toBe("http://localhost:3000")
    expect(hasTransport(config)).toBe(false)
  })

  it("solo el valor exacto \"true\" activa el acuse", () => {
    for (const value of ["false", "1", "si", "TRUE", "yes", ""]) {
      process.env.SEND_LEAD_ACKNOWLEDGEMENT = value
      expect(readEmailConfig().sendAcknowledgement).toBe(false)
    }
    process.env.SEND_LEAD_ACKNOWLEDGEMENT = "true"
    expect(readEmailConfig().sendAcknowledgement).toBe(true)
  })

  it("parsea la lista de destinatarios y descarta huecos y duplicados", () => {
    process.env.LEADS_NOTIFICATION_TO = " uno@porton.test , , dos@porton.test ,uno@porton.test"
    expect(readEmailConfig().notificationTo).toEqual(["uno@porton.test", "dos@porton.test"])
  })

  it("quita la barra final de la URL para no generar enlaces con doble barra", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://elportondelacondesa.com///"
    expect(readEmailConfig().siteUrl).toBe("https://elportondelacondesa.com")
  })

  it("exige clave y remitente para considerar que hay transporte", () => {
    process.env.SENDGRID_API_KEY = "SG.clave"
    expect(hasTransport(readEmailConfig())).toBe(false)

    process.env.LEADS_FROM_EMAIL = "avisos@porton.test"
    expect(hasTransport(readEmailConfig())).toBe(true)
  })
})

describe("resolveEmailProvider", () => {
  it("elige SendGrid cuando hay clave y remitente", () => {
    process.env.SENDGRID_API_KEY = "SG.clave"
    process.env.LEADS_FROM_EMAIL = "avisos@porton.test"

    const provider = resolveEmailProvider()
    expect(provider).toBeInstanceOf(SendGridEmailProvider)
    expect(provider.name).toBe("sendgrid")
  })

  it("elige el adaptador de desarrollo cuando falta cualquiera de las dos", () => {
    const withoutAnything = resolveEmailProvider()
    expect(withoutAnything).toBeInstanceOf(DevelopmentEmailProvider)
    expect(withoutAnything.name).toBe("development")

    process.env.SENDGRID_API_KEY = "SG.clave"
    expect(resolveEmailProvider()).toBeInstanceOf(DevelopmentEmailProvider)

    delete process.env.SENDGRID_API_KEY
    process.env.LEADS_FROM_EMAIL = "avisos@porton.test"
    expect(resolveEmailProvider()).toBeInstanceOf(DevelopmentEmailProvider)
  })
})
