import { randomBytes } from "node:crypto"
import { afterEach, beforeEach, describe, expect, vi } from "vitest"
import { prisma } from "@/lib/db"
import { createAuthTestUser, signInHeaders } from "@/lib/auth/test-helpers"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"
import { hashRateLimitKey, hashVipToken } from "@/lib/security/hash"
import { VIP_COOKIE_NAME } from "@/lib/vip/session"
import { anonymizeLead } from "@/lib/domain/privacy"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"

/**
 * Pruebas de ataque de la fase de endurecimiento.
 *
 * Cada bloque intenta hacer algo que **no debería poder hacerse** y comprueba que
 * el sistema lo impide, no que la interfaz lo esconda. Todas atacan por la vía
 * directa —Route Handler, Server Action o cookie manipulada—, saltándose cualquier
 * pantalla.
 */

// El gate VIP y las Server Actions leen cabeceras y cookies del ámbito de la
// petición, que fuera del runtime de Next hay que simular.
let requestHeaders = new Headers()
const cookieStore = new Map<string, string>()

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name)
      return value ? { name, value } : undefined
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value)
    },
    delete: (name: string) => {
      cookieStore.delete(name)
    },
  }),
}))

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))

// Importaciones estáticas: Vitest eleva los `vi.mock` de arriba por encima de
// ellas, así que estos módulos ya reciben las cabeceras y cookies simuladas. Un
// `await import()` a nivel superior no compila con el `target` de este proyecto.
import { GET as exportCsv } from "@/app/api/admin/crm/export/route"
import { GET as exportLeadData } from "@/app/api/admin/crm/lead-data/route"
import { GET as health } from "@/app/api/health/route"
import { POST as leadRequest } from "@/app/api/leads/requests/route"
import { GET as adminUsers } from "@/app/api/admin/users/route"
import { getVipLead } from "@/lib/vip/session"
import { anonymizeLeadAction, revokeVipSessionsAction } from "@/app/admin/(protected)/privacy-actions"
import { changeRequestStatusAction } from "@/app/admin/(protected)/crm-actions"

const createdEmails: string[] = []
const createdLeadIds: string[] = []
const createdUserIds: string[] = []
/** Claves de rate limit tocadas por este archivo, para no borrar las de otros. */
const usedRateLimitKeys: string[] = []

beforeEach(() => {
  requestHeaders = new Headers()
  cookieStore.clear()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()

  // Por id, no solo por email: `anonymizeLead` sobrescribe justo el email por el
  // que se le reconocería (ver lib/domain/privacy.ts), así que una prueba que
  // anonimiza su lead de prueba dejaba de coincidir con `createdEmails` y el
  // contacto, ya anonimizado, se quedaba en la base para siempre. El id no lo
  // toca la anonimización.
  if (createdLeadIds.length || createdEmails.length) {
    await prisma.lead.deleteMany({
      where: { OR: [{ id: { in: createdLeadIds } }, { emailNormalized: { in: createdEmails } }] },
    })
    createdLeadIds.length = 0
    createdEmails.length = 0
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
  // Solo los contadores que ha creado **este** archivo.
  //
  // Antes se borraba todo lo que empezara por "lead-request-", y eso arrasaba con
  // los contadores de `app/api/leads/requests/route.test.ts`, que corre en
  // paralelo contra la misma base: su prueba del 429 preparaba un contador
  // agotado, este `afterEach` lo borraba en medio, y el endpoint respondía 201
  // porque abría una ventana nueva. Un fallo intermitente que dependía del orden
  // de ejecución y que no tenía nada que ver con lo que ninguna de las dos
  // pruebas quería comprobar.
  if (usedRateLimitKeys.length) {
    await prisma.rateLimitCounter.deleteMany({ where: { key: { in: usedRateLimitKeys } } })
    usedRateLimitKeys.length = 0
  }
})

/**
 * Teléfono distinto en cada llamada.
 *
 * **No es un capricho.** Varios archivos de prueba crean contactos con
 * `+34600112233` y corren en paralelo contra la misma base, así que la
 * comprobación "este teléfono no aparece en la exportación" fallaba por los datos
 * vivos de otro archivo, no por un fallo de la anonimización. Con un número propio,
 * la aserción solo puede hablar de este contacto.
 */
function uniqueTestPhone(): string {
  const digits = Array.from(randomBytes(4))
    .map((byte) => String(byte % 10).repeat(2))
    .join("")
  return `6${digits}`.slice(0, 9)
}

async function createLead() {
  const email = uniqueTestEmail("ataque")
  createdEmails.push(email.toLowerCase())
  const lead = await prisma.lead.create({
    data: {
      email,
      emailNormalized: email.toLowerCase(),
      firstName: "Ana",
      lastName: "García",
      phone: `+34${uniqueTestPhone()}`,
    },
  })
  createdLeadIds.push(lead.id)
  return lead
}

async function sessionFor(role: "ADMIN" | "SALES" | "CONTENT"): Promise<Headers> {
  const { id, email } = await createAuthTestUser(role)
  createdUserIds.push(id)
  return signInHeaders(email)
}

function leadPayload(overrides: Record<string, unknown> = {}) {
  const email = uniqueTestEmail("ataque-form")
  createdEmails.push(email.toLowerCase())
  return {
    firstName: "Ana",
    lastName: "García",
    email,
    eventType: "WEDDING",
    preferredSpace: "salon-porton",
    subject: "Boda",
    message: "Mensaje de prueba",
    privacyConsent: true,
    policyVersion: PRIVACY_POLICY_VERSION,
    sourcePage: "/",
    sourceForm: "contact-home",
    submissionId: `atk-${randomBytes(6).toString("hex")}`,
    formElapsedMs: 9_000,
    ...overrides,
  }
}

async function postLead(payload: unknown, headers: Record<string, string> = {}) {
  const ip = headers["x-forwarded-for"] ?? `198.18.${randomBytes(1)[0]}.${randomBytes(1)[0]}`

  // Se anotan las claves que va a tocar esta petición, para poder borrar después
  // **solo** las propias (ver el `afterEach`). El endpoint limita por IP y por
  // email, así que son dos.
  usedRateLimitKeys.push(`lead-request-ip:${hashRateLimitKey(ip)}`)
  const email = (payload as { email?: unknown })?.email
  if (typeof email === "string") {
    usedRateLimitKeys.push(`lead-request-email:${hashRateLimitKey(email.toLowerCase())}`)
  }

  const response = await leadRequest(
    new Request("http://localhost:3001/api/leads/requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(payload),
    })
  )
  return { response, body: await response.json() }
}

// ---------------------------------------------------------------------------
// 1. Acceso directo a endpoints
// ---------------------------------------------------------------------------

describe("acceso directo a endpoints privados", () => {
  itDb("sin sesión: 401 en exportación, datos de contacto y usuarios", async () => {
    const empty = new Headers()

    expect((await exportCsv(new Request("http://x/api?conjunto=contactos", { headers: empty }))).status).toBe(401)
    expect((await exportLeadData(new Request("http://x/api?lead=abc", { headers: empty }))).status).toBe(401)
    expect((await adminUsers(new Request("http://x/api", { headers: empty }))).status).toBe(401)
  })

  itDb("con rol insuficiente: 403, no 404 ni 200", async () => {
    const sales = await sessionFor("SALES")
    const content = await sessionFor("CONTENT")

    // SALES trabaja el CRM pero no puede sacar datos fuera.
    expect((await exportCsv(new Request("http://x/api?conjunto=contactos", { headers: sales }))).status).toBe(403)
    expect((await exportLeadData(new Request("http://x/api?lead=abc", { headers: sales }))).status).toBe(403)
    // CONTENT no toca el CRM en absoluto.
    expect((await exportCsv(new Request("http://x/api?conjunto=contactos", { headers: content }))).status).toBe(403)
    // Administrar usuarios es solo de ADMIN.
    expect((await adminUsers(new Request("http://x/api", { headers: sales }))).status).toBe(403)
  })

  itDb("CONTENT no obtiene PII por ninguna de las vías de datos", async () => {
    const lead = await createLead()
    const content = await sessionFor("CONTENT")

    const csv = await exportCsv(new Request("http://x/api?conjunto=contactos", { headers: content }))
    const json = await exportLeadData(new Request(`http://x/api?lead=${lead.id}`, { headers: content }))

    expect(csv.status).toBe(403)
    expect(json.status).toBe(403)
    // Y las respuestas de rechazo tampoco cuentan nada del contacto.
    expect(await csv.text()).not.toContain(lead.email)
    expect(await json.text()).not.toContain(lead.email)
  })
})

// ---------------------------------------------------------------------------
// 2. Manipulación de rol
// ---------------------------------------------------------------------------

describe("manipulación de rol", () => {
  itDb("el rol viaja en la sesión de servidor, no en algo que el cliente pueda cambiar", async () => {
    const sales = await sessionFor("SALES")

    // Se intenta declarar un rol por cabecera, cuerpo y cookie a la vez.
    const tampered = new Headers(sales)
    tampered.set("x-role", "ADMIN")
    tampered.set("x-user-role", "ADMIN")
    tampered.append("cookie", "role=ADMIN")

    const response = await exportCsv(new Request("http://x/api?conjunto=contactos", { headers: tampered }))
    expect(response.status).toBe(403)
  })

  itDb("una cookie de sesión inventada no autentica", async () => {
    const forged = new Headers({ cookie: "better-auth.session_token=token-inventado-por-el-atacante" })

    expect((await exportCsv(new Request("http://x/api?conjunto=contactos", { headers: forged }))).status).toBe(401)
    expect((await adminUsers(new Request("http://x/api", { headers: forged }))).status).toBe(401)
  })

  itDb("SALES no puede anonimizar ni revocar accesos aunque llame a la acción directamente", async () => {
    const lead = await createLead()
    requestHeaders = await sessionFor("SALES")

    const anonymize = await anonymizeLeadAction({ leadId: lead.id })
    const revoke = await revokeVipSessionsAction({ leadId: lead.id })

    expect(anonymize.ok).toBe(false)
    expect(revoke.ok).toBe(false)

    const unchanged = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(unchanged.lifecycle).toBe("ACTIVE")
    expect(unchanged.email).toBe(lead.email)
  })

  itDb("CONTENT no puede mover una solicitud de estado", async () => {
    const lead = await createLead()
    const request = await prisma.leadRequest.create({
      data: { leadId: lead.id, eventType: "WEDDING", subject: "Boda" },
    })
    requestHeaders = await sessionFor("CONTENT")

    const result = await changeRequestStatusAction({ requestId: request.id, nextStatus: "PRESENTATION" })

    expect(result.ok).toBe(false)
    expect((await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("CONTACT")
  })
})

// ---------------------------------------------------------------------------
// 3. Cookie VIP falsa y contenido VIP sin sesión
// ---------------------------------------------------------------------------

describe("cookie de acceso VIP", () => {
  itDb("un token inventado no resuelve ningún contacto", async () => {
    cookieStore.set(VIP_COOKIE_NAME, "token-inventado-por-el-atacante")
    expect(await getVipLead()).toBeNull()
  })

  itDb("el hash almacenado no sirve como token", async () => {
    const lead = await createLead()
    const token = randomBytes(32).toString("hex")
    const tokenHash = hashVipToken(token)
    await prisma.vipAccessSession.create({
      data: { leadId: lead.id, tokenHash, expiresAt: new Date(Date.now() + 60_000) },
    })

    // Con el token correcto sí entra.
    cookieStore.set(VIP_COOKIE_NAME, token)
    expect((await getVipLead())?.id).toBe(lead.id)

    // Con el hash (que es lo que se filtraría en un volcado de base de datos) no.
    cookieStore.set(VIP_COOKIE_NAME, tokenHash)
    expect(await getVipLead()).toBeNull()
  })

  itDb("una sesión caducada o revocada no vale", async () => {
    const lead = await createLead()

    const expiredToken = randomBytes(32).toString("hex")
    await prisma.vipAccessSession.create({
      data: { leadId: lead.id, tokenHash: hashVipToken(expiredToken), expiresAt: new Date(Date.now() - 1_000) },
    })
    cookieStore.set(VIP_COOKIE_NAME, expiredToken)
    expect(await getVipLead()).toBeNull()

    const revokedToken = randomBytes(32).toString("hex")
    await prisma.vipAccessSession.create({
      data: {
        leadId: lead.id,
        tokenHash: hashVipToken(revokedToken),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      },
    })
    cookieStore.set(VIP_COOKIE_NAME, revokedToken)
    expect(await getVipLead()).toBeNull()
  })

  itDb("revocar deja inservible una cookie que ya estaba en el navegador", async () => {
    const lead = await createLead()
    const token = randomBytes(32).toString("hex")
    await prisma.vipAccessSession.create({
      data: { leadId: lead.id, tokenHash: hashVipToken(token), expiresAt: new Date(Date.now() + 60_000) },
    })

    cookieStore.set(VIP_COOKIE_NAME, token)
    expect(await getVipLead()).not.toBeNull()

    requestHeaders = await sessionFor("ADMIN")
    const result = await revokeVipSessionsAction({ leadId: lead.id })
    expect(result.ok).toBe(true)

    // La cookie sigue en el navegador, pero ya no vale nada.
    expect(await getVipLead()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. Formulario público: payload, inyección y límites
// ---------------------------------------------------------------------------

describe("formulario público", () => {
  itDb("un payload enorme se rechaza sin llegar a la base de datos", async () => {
    const payload = leadPayload({ message: "x".repeat(200_000) })
    const { response, body } = await postLead(payload)

    expect(response.status).toBe(413)
    expect(body.code).toBe("payload-too-large")
    expect(await prisma.lead.count({ where: { emailNormalized: String(payload.email).toLowerCase() } })).toBe(0)
  })

  itDb("el HTML y el script se guardan como texto, no se interpretan", async () => {
    const hostile = '<script>alert("xss")</script><img src=x onerror=alert(1)>'
    const payload = leadPayload({ message: hostile, subject: hostile })
    const { response } = await postLead(payload)

    expect(response.status).toBe(201)
    const saved = await prisma.leadRequest.findFirstOrThrow({
      where: { lead: { emailNormalized: String(payload.email).toLowerCase() } },
    })
    // Se guarda tal cual (es el testimonio de la persona); el escapado es de salida.
    expect(saved.message).toBe(hostile)
  })

  itDb("el rate limit por IP corta la repetición", async () => {
    const ip = "198.18.77.77"
    const key = `lead-request-ip:${hashRateLimitKey(ip)}`
    await prisma.rateLimitCounter.upsert({
      where: { key },
      create: { key, count: 9_999, windowStartedAt: new Date() },
      update: { count: 9_999, windowStartedAt: new Date() },
    })

    const payload = leadPayload()
    const { response, body } = await postLead(payload, { "x-forwarded-for": ip })

    expect(response.status).toBe(429)
    expect(body.code).toBe("rate-limited")
    await prisma.rateLimitCounter.deleteMany({ where: { key } })
  })

  itDb("un origen ajeno se rechaza", async () => {
    const { response } = await postLead(leadPayload(), {
      origin: "https://sitio-atacante.example",
      host: "localhost:3001",
    })
    expect(response.status).toBe(403)
  })

  itDb("una respuesta de error no devuelve stack ni detalle interno", async () => {
    const { body } = await postLead(leadPayload({ eventType: "INVENTADO" }))
    const serialized = JSON.stringify(body)

    expect(serialized).not.toContain("at ")
    expect(serialized).not.toContain("prisma")
    expect(serialized).not.toContain("Error:")
    expect(serialized).not.toContain("node_modules")
  })
})

// ---------------------------------------------------------------------------
// 5. Contacto anonimizado
// ---------------------------------------------------------------------------

describe("contacto anonimizado", () => {
  itDb("no reaparece en la exportación comercial ni en la de sus datos", async () => {
    const lead = await createLead()
    // El teléfono y el asunto llevan una marca única de esta ejecución: la
    // aserción es "lo de **este** contacto ha desaparecido", no "esta cadena no
    // existe en toda la tabla", que en una base compartida no lo puede garantizar
    // ninguna prueba.
    const marca = randomBytes(6).toString("hex")
    await prisma.leadRequest.create({
      data: {
        leadId: lead.id,
        eventType: "WEDDING",
        subject: `Boda de Ana ${marca}`,
        message: `Soy Ana y mi teléfono es ${lead.phone} (${marca})`,
        guestCount: 120,
      },
    })
    await prisma.leadNote.create({ data: { leadId: lead.id, body: `Nota con su nombre: Ana García ${marca}` } })

    const originalEmail = lead.email
    const originalPhone = lead.phone as string
    await anonymizeLead(lead.id)

    const admin = await sessionFor("ADMIN")

    const csv = await exportCsv(new Request("http://x/api?conjunto=contactos", { headers: admin }))
    const csvText = await csv.text()
    expect(csvText).not.toContain(originalEmail)
    expect(csvText).not.toContain(originalPhone)

    const requestsCsv = await exportCsv(new Request("http://x/api?conjunto=solicitudes", { headers: admin }))
    const requestsText = await requestsCsv.text()
    expect(requestsText).not.toContain(marca)
    expect(requestsText).not.toContain(originalPhone)

    const json = await exportLeadData(new Request(`http://x/api?lead=${lead.id}`, { headers: admin }))
    const jsonText = await json.text()
    expect(jsonText).not.toContain(originalEmail)
    expect(jsonText).not.toContain("Ana García")
    expect(jsonText).not.toContain("600112233")
  })

  itDb("conserva lo agregable y la auditoría", async () => {
    const lead = await createLead()
    await prisma.leadRequest.create({
      data: { leadId: lead.id, eventType: "WEDDING", guestCount: 150, subject: "Con asunto", utmSource: "instagram" },
    })

    const summary = await anonymizeLead(lead.id)

    const request = await prisma.leadRequest.findFirstOrThrow({ where: { leadId: lead.id } })
    // Las métricas siguen cuadrando.
    expect(request.eventType).toBe("WEDDING")
    expect(request.guestCount).toBe(150)
    expect(request.utmSource).toBe("instagram")
    // El texto libre desaparece.
    expect(request.subject).toBeNull()
    expect(summary.notesDeleted).toBeGreaterThanOrEqual(0)

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "Lead", entityId: lead.id, action: "privacy.anonymize" },
    })
    expect(audit).not.toBeNull()
  })

  itDb("anonimizar dos veces no es un paso silencioso", async () => {
    const lead = await createLead()
    await anonymizeLead(lead.id)
    await expect(anonymizeLead(lead.id)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 6. Caché de PII y healthcheck
// ---------------------------------------------------------------------------

describe("caché y healthcheck", () => {
  itDb("las respuestas con datos personales llevan no-store", async () => {
    const admin = await sessionFor("ADMIN")

    const csv = await exportCsv(new Request("http://x/api?conjunto=contactos", { headers: admin }))
    expect(csv.headers.get("cache-control")).toBe("no-store")

    const lead = await createLead()
    const json = await exportLeadData(new Request(`http://x/api?lead=${lead.id}`, { headers: admin }))
    expect(json.headers.get("cache-control")).toBe("no-store")
    expect(json.headers.get("content-disposition")).toContain("attachment")
  })

  itDb("el healthcheck no revela versiones, secretos ni excepciones", async () => {
    const response = await health(new Request("http://x/api/health"))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(JSON.parse(text)).toEqual({ status: "ok" })
    expect(response.headers.get("cache-control")).toBe("no-store")

    for (const leak of ["next", "prisma", "16.", "postgres", "supabase", "SG.", "version", "node"]) {
      expect(text.toLowerCase()).not.toContain(leak.toLowerCase())
    }
  })
})
