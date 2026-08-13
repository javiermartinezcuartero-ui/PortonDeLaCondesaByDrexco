import { afterEach, beforeEach, describe, expect, vi } from "vitest"
import { prisma } from "@/lib/db"
import { verifyVipAccessSession } from "@/lib/domain/vip-sessions"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

// El Server Action lee cabeceras y escribe cookies: fuera del runtime de Next
// no hay scope de petición, así que se simulan ambos.
let requestHeaders = new Headers()
const cookieStore = new Map<string, { value: string; options: Record<string, unknown> }>()

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({
    get: (name: string) => {
      const entry = cookieStore.get(name)
      return entry ? { name, value: entry.value } : undefined
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieStore.set(name, { value, options })
    },
  }),
}))

const revalidatePath = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }))

import { submitVipGateAction } from "@/lib/vip/gate-action"
import { VIP_COOKIE_NAME } from "@/lib/vip/session"

const createdEmails: string[] = []

/** Cada test usa una IP distinta para no compartir el contador de rate limit. */
let ipCounter = 0
function nextIp(): string {
  ipCounter += 1
  return `198.18.${(ipCounter >> 8) & 255}.${ipCounter & 255}`
}

function baseInput(overrides: Record<string, unknown> = {}) {
  const email = uniqueTestEmail("gate")
  createdEmails.push(email.toLowerCase())
  return {
    email,
    privacyConsent: true,
    policyVersion: PRIVACY_POLICY_VERSION,
    marketingConsent: false,
    section: "REAL_WEDDING" as const,
    returnPath: "/bodas-reales",
    ...overrides,
  }
}

beforeEach(() => {
  requestHeaders = new Headers({ "x-forwarded-for": nextIp() })
  cookieStore.clear()
  revalidatePath.mockClear()
})

afterEach(async () => {
  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
  await prisma.rateLimitCounter.deleteMany({ where: { key: { startsWith: "vip-gate:" } } })
})

describe("submitVipGateAction — validación", () => {
  itDb("rechaza un email inválido y no crea ningún Lead", async () => {
    const result = await submitVipGateAction(baseInput({ email: "no-es-un-email" }))
    expect(result).toEqual({ ok: false, code: "invalid-email" })
    expect(cookieStore.has(VIP_COOKIE_NAME)).toBe(false)
  })

  itDb("la privacidad es obligatoria: sin ella no hay acceso ni Lead", async () => {
    const input = baseInput({ privacyConsent: false })
    const result = await submitVipGateAction(input)

    expect(result).toEqual({ ok: false, code: "privacy-required" })
    expect(cookieStore.has(VIP_COOKIE_NAME)).toBe(false)
    expect(
      await prisma.lead.count({ where: { emailNormalized: (input.email as string).toLowerCase() } })
    ).toBe(0)
  })

  itDb("el honeypot relleno rechaza la petición (bot) sin crear nada", async () => {
    const input = baseInput({ honeypot: "http://spam.example.com" })
    const result = await submitVipGateAction(input)

    expect(result).toEqual({ ok: false, code: "invalid-request" })
    expect(
      await prisma.lead.count({ where: { emailNormalized: (input.email as string).toLowerCase() } })
    ).toBe(0)
  })

  itDb("rechaza una sección inexistente", async () => {
    const result = await submitVipGateAction(baseInput({ section: "CUMPLEANOS" }))
    expect(result).toEqual({ ok: false, code: "invalid-request" })
  })

  itDb("rechaza un returnPath externo (no se puede usar para redirigir fuera)", async () => {
    expect(await submitVipGateAction(baseInput({ returnPath: "https://evil.example.com" }))).toEqual({
      ok: false,
      code: "invalid-request",
    })
    expect(await submitVipGateAction(baseInput({ returnPath: "//evil.example.com" }))).toEqual({
      ok: false,
      code: "invalid-request",
    })
  })
})

describe("submitVipGateAction — acceso concedido", () => {
  itDb("crea el Lead, la sesión y entrega una cookie con un token que valida", async () => {
    const input = baseInput()
    const result = await submitVipGateAction(input)
    expect(result).toEqual({ ok: true })

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })

    const cookie = cookieStore.get(VIP_COOKIE_NAME)
    expect(cookie).toBeDefined()

    // El token de la cookie resuelve la sesión de este lead.
    const resolved = await verifyVipAccessSession(cookie!.value)
    expect(resolved?.id).toBe(lead.id)
  })

  itDb("la cookie es HttpOnly, SameSite=lax, con caducidad, y no contiene el email", async () => {
    const input = baseInput()
    await submitVipGateAction(input)

    const cookie = cookieStore.get(VIP_COOKIE_NAME)!
    expect(cookie.options.httpOnly).toBe(true)
    expect(cookie.options.sameSite).toBe("lax")
    expect(cookie.options.path).toBe("/")
    expect(cookie.options.maxAge).toBe(60 * 60 * 24 * 30)

    // Ni el email ni el id del lead viajan en la cookie.
    expect(cookie.value).not.toContain(input.email as string)
    expect(cookie.value).not.toContain("@")
  })

  itDb("en base de datos solo se guarda el hash, nunca el token en claro", async () => {
    const input = baseInput()
    await submitVipGateAction(input)
    const token = cookieStore.get(VIP_COOKIE_NAME)!.value

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })
    const session = await prisma.vipAccessSession.findFirstOrThrow({ where: { leadId: lead.id } })

    expect(session.tokenHash).not.toBe(token)
    expect(session.tokenHash).not.toContain(token)
  })

  itDb("registra el consentimiento de privacidad con la versión de la política", async () => {
    const input = baseInput()
    await submitVipGateAction(input)

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })
    const consents = await prisma.consentEvent.findMany({ where: { leadId: lead.id } })

    expect(consents).toHaveLength(1)
    expect(consents[0]).toMatchObject({
      purpose: "PRIVACY",
      granted: true,
      policyVersion: PRIVACY_POLICY_VERSION,
    })
  })

  itDb("una política caducada no concede acceso ni registra un consentimiento falso", async () => {
    // Regresión. El gate no recibía la versión de la política: guardaba la
    // constante del servidor. Si la política cambiaba mientras alguien tenía la
    // página abierta, se registraba un ConsentEvent con una versión que esa persona
    // nunca había visto — y `policyVersion` es exactamente el campo que existe para
    // demostrar sobre qué texto se consintió. El endpoint del formulario ya
    // devolvía 409 en ese caso; el gate no comprobaba nada.
    const input = baseInput({ policyVersion: "1999-01" })

    const result = await submitVipGateAction(input)

    expect(result).toEqual({ ok: false, code: "policy-version-mismatch" })

    // Y no se ha escrito nada: ni contacto, ni consentimiento, ni sesión.
    const lead = await prisma.lead.findUnique({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })
    expect(lead).toBeNull()
  })

  itDb("el consentimiento se registra con la versión que aceptó la persona", async () => {
    // La cara positiva: la versión guardada tiene que venir del cliente, no de la
    // constante del servidor. Con las dos coincidiendo hoy, la única forma de
    // distinguirlo es comprobar que el valor llega hasta la fila.
    const input = baseInput({ marketingConsent: true })
    await submitVipGateAction(input)

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })
    const consents = await prisma.consentEvent.findMany({ where: { leadId: lead.id } })

    expect(consents).toHaveLength(2)
    for (const consent of consents) {
      expect(consent.policyVersion).toBe(input.policyVersion)
    }
  })

  itDb("el marketing es opcional: sin marcar no genera ConsentEvent de marketing", async () => {
    const input = baseInput({ marketingConsent: false })
    await submitVipGateAction(input)

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })
    expect(await prisma.consentEvent.count({ where: { leadId: lead.id, purpose: "MARKETING" } })).toBe(0)
  })

  itDb("el marketing marcado genera un ConsentEvent separado del de privacidad", async () => {
    const input = baseInput({ marketingConsent: true })
    await submitVipGateAction(input)

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })
    const consents = await prisma.consentEvent.findMany({ where: { leadId: lead.id } })

    // Son dos eventos independientes; el orden entre ellos no es relevante.
    expect(consents).toHaveLength(2)
    expect(consents.map((consent) => consent.purpose).sort()).toEqual(["MARKETING", "PRIVACY"])
    expect(consents.every((consent) => consent.granted)).toBe(true)
  })

  itDb("registra LeadActivity VIP_ACCESSED y ContentInteraction GATE_GRANTED de la sección de entrada", async () => {
    const input = baseInput({ section: "CATERING_EVENT", returnPath: "/catering" })
    await submitVipGateAction(input)

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })

    const activity = await prisma.leadActivity.findFirstOrThrow({ where: { leadId: lead.id } })
    expect(activity.type).toBe("VIP_ACCESSED")

    const interaction = await prisma.contentInteraction.findFirstOrThrow({ where: { leadId: lead.id } })
    expect(interaction).toMatchObject({ type: "GATE_GRANTED", section: "CATERING_EVENT" })
  })

  itDb("guarda la atribución en la actividad, sin datos personales", async () => {
    const input = baseInput({
      attribution: { utmSource: "instagram", utmMedium: "social", utmCampaign: "bodas-2026" },
    })
    await submitVipGateAction(input)

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { emailNormalized: (input.email as string).toLowerCase() },
    })

    const activity = await prisma.leadActivity.findFirstOrThrow({ where: { leadId: lead.id } })
    expect(activity.metadata).toMatchObject({ utmSource: "instagram", utmCampaign: "bodas-2026" })

    const interaction = await prisma.contentInteraction.findFirstOrThrow({ where: { leadId: lead.id } })
    expect(interaction.utmSource).toBe("instagram")
  })

  itDb("revalida las dos bibliotecas, porque una sesión desbloquea ambas", async () => {
    await submitVipGateAction(baseInput())

    const paths = revalidatePath.mock.calls.map(([path]) => path)
    expect(paths).toContain("/bodas-reales")
    expect(paths).toContain("/catering")
  })

  itDb("normaliza el email: mayúsculas y espacios no crean un Lead distinto", async () => {
    const email = uniqueTestEmail("normaliza")
    createdEmails.push(email.toLowerCase())

    await submitVipGateAction(baseInput({ email: `  ${email.toUpperCase()}  ` }))

    const leads = await prisma.lead.findMany({ where: { emailNormalized: email.toLowerCase() } })
    expect(leads).toHaveLength(1)
  })
})

describe("submitVipGateAction — Lead existente", () => {
  itDb("no sobrescribe datos mejores de un Lead que ya venía del formulario de contacto", async () => {
    const email = uniqueTestEmail("existente")
    createdEmails.push(email.toLowerCase())

    // Lead con datos completos, como los dejaría el formulario de contacto.
    const existing = await prisma.lead.create({
      data: {
        email,
        emailNormalized: email.toLowerCase(),
        firstName: "Ana",
        lastName: "García",
        phone: "+34600111222",
        phoneNormalized: "+34600111222",
        firstSource: "formulario-contacto",
      },
    })

    await submitVipGateAction(baseInput({ email }))

    const after = await prisma.lead.findUniqueOrThrow({ where: { id: existing.id } })
    expect(after.firstName).toBe("Ana")
    expect(after.lastName).toBe("García")
    expect(after.phone).toBe("+34600111222")
    // El origen original se conserva; solo se actualiza el más reciente.
    expect(after.firstSource).toBe("formulario-contacto")
    expect(after.lastSource).toBe("vip-gate:bodas-reales")
  })

  itDb("no revela si el email ya existía: el resultado es idéntico", async () => {
    const email = uniqueTestEmail("mismo-resultado")
    createdEmails.push(email.toLowerCase())

    const first = await submitVipGateAction(baseInput({ email }))
    requestHeaders = new Headers({ "x-forwarded-for": nextIp() })
    const second = await submitVipGateAction(baseInput({ email }))

    expect(first).toEqual({ ok: true })
    expect(second).toEqual(first)
  })

  itDb("una segunda entrada del mismo email añade una sesión, sin duplicar el Lead", async () => {
    const email = uniqueTestEmail("dos-sesiones")
    createdEmails.push(email.toLowerCase())

    await submitVipGateAction(baseInput({ email }))
    requestHeaders = new Headers({ "x-forwarded-for": nextIp() })
    await submitVipGateAction(baseInput({ email }))

    const leads = await prisma.lead.findMany({ where: { emailNormalized: email.toLowerCase() } })
    expect(leads).toHaveLength(1)
    expect(await prisma.vipAccessSession.count({ where: { leadId: leads[0].id } })).toBe(2)
  })
})

describe("submitVipGateAction — rate limit", () => {
  itDb("bloquea tras agotar los intentos de la misma IP", async () => {
    const ip = nextIp()
    requestHeaders = new Headers({ "x-forwarded-for": ip })

    // El límite configurado es de 5 intentos cada 10 minutos.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await submitVipGateAction(baseInput())
      expect(result, `intento ${attempt}`).toEqual({ ok: true })
    }

    const blocked = await submitVipGateAction(baseInput())
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.code).toBe("rate-limited")
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    }
  })
})
