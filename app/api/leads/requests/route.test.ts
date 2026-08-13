import { randomBytes } from "node:crypto"
import { afterEach, beforeEach, describe, expect, vi } from "vitest"
import { prisma } from "@/lib/db"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { hashRateLimitKey } from "@/lib/security/hash"
import { itDb, uniqueSlug, uniqueTestEmail } from "@/lib/domain/test-helpers"
import { MAX_GUEST_COUNT, MIN_FORM_FILL_MS } from "@/lib/validation/lead-request"
import { POST } from "./route"

const ENDPOINT = "http://localhost:3001/api/leads/requests"

const createdEmails: string[] = []
const createdContentIds: string[] = []
const usedIps: string[] = []

/**
 * IP distinta por petición. Derivada de bytes aleatorios y no de un contador,
 * porque Vitest aísla el registro de módulos por archivo: dos archivos de test
 * en paralelo reiniciarían el contador y compartirían ventana de rate limit.
 */
function nextIp(): string {
  const [a, b, c] = randomBytes(3)
  const ip = `198.18.${(a ^ b) & 255}.${c & 255}`
  usedIps.push(ip)
  return ip
}

function basePayload(overrides: Record<string, unknown> = {}) {
  const email = uniqueTestEmail("lead-request")
  createdEmails.push(email.toLowerCase())

  return {
    firstName: "Ana",
    lastName: "García",
    email,
    phone: "+34 600 111 222",
    eventType: "WEDDING",
    eventDate: "",
    guestCount: "",
    preferredSpace: "salon-porton",
    budgetRange: "",
    subject: "Boda en septiembre",
    message: "Nos gustaría visitar la finca y conocer disponibilidad.",
    privacyConsent: true,
    marketingConsent: false,
    policyVersion: PRIVACY_POLICY_VERSION,
    sourcePage: "/",
    sourceForm: "contact-home",
    submissionId: `sub-${randomBytes(8).toString("hex")}`,
    formElapsedMs: MIN_FORM_FILL_MS + 2_000,
    ...overrides,
  }
}

type PostOptions = { ip?: string; headers?: Record<string, string>; rawBody?: string }

async function post(payload: unknown, options: PostOptions = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": options.ip ?? nextIp(),
    ...options.headers,
  })

  const response = await POST(new Request(ENDPOINT, { method: "POST", headers, body: options.rawBody ?? JSON.stringify(payload) }))
  return { response, body: await response.json() }
}

function leadFor(email: string) {
  return prisma.lead.findUnique({
    where: { emailNormalized: email.toLowerCase() },
    include: { requests: true, consents: true, activities: true },
  })
}

beforeEach(() => {
  // El endpoint registra el motivo de un fallo de persistencia por consola; en
  // los tests que lo provocan a propósito ese ruido no aporta nada.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()

  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
  if (createdContentIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdContentIds } } })
    createdContentIds.length = 0
  }
  if (usedIps.length) {
    const keys = usedIps.map((ip) => `lead-request-ip:${hashRateLimitKey(ip)}`)
    await prisma.rateLimitCounter.deleteMany({ where: { key: { in: keys } } })
    usedIps.length = 0
  }
  // Solo los contadores por email de **este** archivo. Antes se borraba todo lo
  // que empezara por "lead-request-email:", y eso pisaba los de otros archivos que
  // corren en paralelo contra la misma base (ver el mismo arreglo, en el otro
  // sentido, en lib/security/attack-surface.test.ts).
  if (createdEmails.length) {
    const keys = createdEmails.map((email) => `lead-request-email:${hashRateLimitKey(email)}`)
    await prisma.rateLimitCounter.deleteMany({ where: { key: { in: keys } } })
  }
})

describe("POST /api/leads/requests — solicitud válida", () => {
  itDb("crea Lead, LeadRequest, consentimiento y actividad en un solo envío", async () => {
    const payload = basePayload({ eventDate: "2027-06-12", guestCount: "150", budgetRange: "20000-35000" })
    const { response, body } = await post(payload)

    expect(response.status).toBe(201)
    expect(body).toEqual({ ok: true, duplicate: false })

    const lead = await leadFor(payload.email)
    expect(lead).not.toBeNull()
    expect(lead?.firstName).toBe("Ana")
    expect(lead?.requests).toHaveLength(1)

    const request = lead!.requests[0]
    expect(request.eventType).toBe("WEDDING")
    expect(request.guestCount).toBe(150)
    expect(request.eventDate?.toISOString().slice(0, 10)).toBe("2027-06-12")
    expect(request.preferredSpace).toBe("salon-porton")
    expect(request.budgetRange).toBe("20000-35000")
    expect(request.subject).toBe("Boda en septiembre")
    expect(request.status).toBe("NEW")

    expect(lead!.consents.filter((consent) => consent.purpose === "PRIVACY")).toHaveLength(1)
    expect(lead!.consents[0].policyVersion).toBe(PRIVACY_POLICY_VERSION)
    expect(lead!.activities.filter((activity) => activity.type === "FORM_SUBMITTED")).toHaveLength(1)
  })

  itDb("guarda el texto libre tal como se escribió, sin transformarlo", async () => {
    const message = 'Queremos algo así: <b>rústico</b> & con "photocall"'
    const payload = basePayload({ message })
    await post(payload)

    const lead = await leadFor(payload.email)
    expect(lead?.requests[0].message).toBe(message)
  })
})

describe("POST /api/leads/requests — historial de solicitudes", () => {
  itDb("el mismo email con dos solicitudes conserva las dos", async () => {
    const first = basePayload({ subject: "Primera consulta" })
    const second = { ...first, subject: "Segunda consulta", submissionId: `sub-${randomBytes(8).toString("hex")}` }

    expect((await post(first)).response.status).toBe(201)
    expect((await post(second)).response.status).toBe(201)

    const lead = await leadFor(first.email)
    expect(lead?.requests).toHaveLength(2)
    expect(lead?.requests.map((request) => request.subject).sort()).toEqual(["Primera consulta", "Segunda consulta"])
    // Un único Lead para las dos: la persona no se duplica.
    expect(await prisma.lead.count({ where: { emailNormalized: first.email.toLowerCase() } })).toBe(1)
  })

  itDb("conserva el primer origen y actualiza el último (first touch / last touch)", async () => {
    const first = basePayload({ utmSource: "instagram" })
    const second = {
      ...first,
      utmSource: "google",
      submissionId: `sub-${randomBytes(8).toString("hex")}`,
    }

    await post(first)
    await post(second)

    const lead = await leadFor(first.email)
    expect(lead?.firstSource).toBe("instagram")
    expect(lead?.lastSource).toBe("google")
  })
})

describe("POST /api/leads/requests — consentimientos", () => {
  itDb("rechaza la solicitud sin consentimiento de privacidad y no guarda nada", async () => {
    const payload = basePayload({ privacyConsent: false })
    const { response, body } = await post(payload)

    expect(response.status).toBe(400)
    expect(body.code).toBe("invalid-payload")
    expect(body.fields).toContain("privacyConsent")
    expect(await leadFor(payload.email)).toBeNull()
  })

  itDb("con marketing en false guarda la solicitud y no registra consentimiento de marketing", async () => {
    const payload = basePayload({ marketingConsent: false })
    const { response } = await post(payload)

    expect(response.status).toBe(201)
    const lead = await leadFor(payload.email)
    expect(lead?.consents.map((consent) => consent.purpose)).toEqual(["PRIVACY"])
  })

  itDb("con marketing en true registra los dos consentimientos por separado", async () => {
    const payload = basePayload({ marketingConsent: true })
    await post(payload)

    const lead = await leadFor(payload.email)
    const purposes = lead!.consents.map((consent) => consent.purpose)
    expect(purposes).toContain("PRIVACY")
    expect(purposes).toContain("MARKETING")
    expect(lead!.consents.every((consent) => consent.granted)).toBe(true)
  })

  itDb("una casilla de marketing sin marcar no revoca un consentimiento anterior", async () => {
    const withMarketing = basePayload({ marketingConsent: true })
    await post(withMarketing)

    const withoutMarketing = {
      ...withMarketing,
      marketingConsent: false,
      submissionId: `sub-${randomBytes(8).toString("hex")}`,
    }
    await post(withoutMarketing)

    const lead = await leadFor(withMarketing.email)
    const marketing = lead!.consents.filter((consent) => consent.purpose === "MARKETING")
    // Sigue habiendo un único evento y sigue siendo un "sí": dejar la casilla
    // vacía en un formulario de contacto no es una baja.
    expect(marketing).toHaveLength(1)
    expect(marketing[0].granted).toBe(true)
  })

  itDb("rechaza una versión de política que no es la vigente", async () => {
    const payload = basePayload({ policyVersion: "1999-01" })
    const { response, body } = await post(payload)

    expect(response.status).toBe(409)
    expect(body.code).toBe("policy-version-mismatch")
    expect(await leadFor(payload.email)).toBeNull()
  })
})

describe("POST /api/leads/requests — validación", () => {
  itDb("rechaza una fecha de evento en el pasado", async () => {
    const payload = basePayload({ eventDate: "2020-05-01" })
    const { response, body } = await post(payload)

    expect(response.status).toBe(400)
    expect(body.fields).toContain("eventDate")
    expect(await leadFor(payload.email)).toBeNull()
  })

  itDb("rechaza un número de invitados imposible", async () => {
    const payload = basePayload({ guestCount: String(MAX_GUEST_COUNT + 1) })
    const { response, body } = await post(payload)

    expect(response.status).toBe(400)
    expect(body.fields).toContain("guestCount")
  })

  itDb("rechaza un payload por encima del tamaño máximo", async () => {
    const payload = basePayload({ message: "x".repeat(64 * 1024) })
    const { response, body } = await post(payload)

    expect(response.status).toBe(413)
    expect(body.code).toBe("payload-too-large")
    expect(await leadFor(payload.email)).toBeNull()
  })

  itDb("rechaza un cuerpo que no es JSON válido", async () => {
    const { response, body } = await post(undefined, { rawBody: "{ esto no es json" })
    expect(response.status).toBe(400)
    expect(body.code).toBe("invalid-payload")
  })

  itDb("rechaza una petición sin content-type JSON", async () => {
    const { response, body } = await post(basePayload(), { headers: { "content-type": "text/plain" } })
    expect(response.status).toBe(415)
    expect(body.code).toBe("invalid-request")
  })

  itDb("rechaza una petición desde otro origen", async () => {
    const payload = basePayload()
    const { response, body } = await post(payload, {
      headers: { origin: "https://sitio-ajeno.example", host: "localhost:3001" },
    })

    expect(response.status).toBe(403)
    expect(body.code).toBe("invalid-request")
    expect(await leadFor(payload.email)).toBeNull()
  })

  itDb("acepta una petición cuyo origen coincide con el host", async () => {
    const payload = basePayload()
    const { response } = await post(payload, {
      headers: { origin: "http://localhost:3001", host: "localhost:3001" },
    })

    expect(response.status).toBe(201)
  })

  itDb("los nombres de campo del error no revelan los valores recibidos", async () => {
    const payload = basePayload({ email: "ana-secreta@example.test", eventType: "CUMPLEANOS" })
    const { body } = await post(payload)

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("ana-secreta")
    expect(serialized).not.toContain("CUMPLEANOS")
  })
})

describe("POST /api/leads/requests — antispam", () => {
  itDb("el honeypot relleno responde como si todo fuera bien pero no guarda nada", async () => {
    const payload = basePayload({ honeypot: "http://spam.example.com" })
    const { response, body } = await post(payload)

    expect(response.status).toBe(202)
    expect(body).toEqual({ ok: true, duplicate: false })
    expect(await leadFor(payload.email)).toBeNull()
  })

  itDb("rechaza un envío más rápido que el tiempo mínimo de formulario", async () => {
    const payload = basePayload({ formElapsedMs: 200 })
    const { response, body } = await post(payload)

    expect(response.status).toBe(400)
    expect(body.code).toBe("too-fast")
    expect(await leadFor(payload.email)).toBeNull()
  })

  itDb("devuelve 429 cuando el contador de la IP está agotado", async () => {
    const ip = nextIp()
    // Se agota el contador directamente en la tabla: así el test no depende del
    // máximo configurado, solo de que el endpoint respete el límite.
    await prisma.rateLimitCounter.upsert({
      where: { key: `lead-request-ip:${hashRateLimitKey(ip)}` },
      create: { key: `lead-request-ip:${hashRateLimitKey(ip)}`, count: 9_999, windowStartedAt: new Date() },
      update: { count: 9_999, windowStartedAt: new Date() },
    })

    const payload = basePayload()
    const { response, body } = await post(payload, { ip })

    expect(response.status).toBe(429)
    expect(body.code).toBe("rate-limited")
    expect(body.retryAfterSeconds).toBeGreaterThan(0)
    expect(await leadFor(payload.email)).toBeNull()
  })

  itDb("un doble clic con la misma clave de envío crea una sola solicitud", async () => {
    const payload = basePayload()

    const [first, second] = await Promise.all([post(payload, { ip: "198.18.99.99" }), post(payload, { ip: "198.18.99.99" })])
    usedIps.push("198.18.99.99")

    // Una de las dos gana la carrera; la otra reconoce el duplicado.
    const statuses = [first.response.status, second.response.status].sort()
    expect(statuses).toEqual([200, 201])
    expect([first.body.duplicate, second.body.duplicate].sort()).toEqual([false, true])

    const lead = await leadFor(payload.email)
    expect(lead?.requests).toHaveLength(1)
    // El consentimiento tampoco se duplica: va en la misma transacción.
    expect(lead?.consents).toHaveLength(1)
  })

  itDb("reenviar con la misma clave tras una respuesta perdida no duplica la solicitud", async () => {
    const payload = basePayload()

    const first = await post(payload)
    const second = await post(payload)

    expect(first.response.status).toBe(201)
    expect(second.response.status).toBe(200)
    expect(second.body.duplicate).toBe(true)

    const lead = await leadFor(payload.email)
    expect(lead?.requests).toHaveLength(1)
  })
})

describe("POST /api/leads/requests — atribución", () => {
  itDb("guarda las UTMs completas, el referrer y la página de origen", async () => {
    const payload = basePayload({
      sourcePage: "/bodas-reales",
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "verano-2027",
      utmContent: "story-3",
      utmTerm: "finca bodas murcia",
      referrer: "https://www.instagram.com/",
    })
    await post(payload)

    const lead = await leadFor(payload.email)
    const request = lead!.requests[0]
    expect(request.utmSource).toBe("instagram")
    expect(request.utmMedium).toBe("social")
    expect(request.utmCampaign).toBe("verano-2027")
    expect(request.utmContent).toBe("story-3")
    expect(request.utmTerm).toBe("finca bodas murcia")
    expect(request.referrer).toBe("https://www.instagram.com/")
    expect(request.sourcePage).toBe("/bodas-reales")
  })

  itDb("conserva sourceContentId cuando la solicitud viene del CTA de una ficha publicada", async () => {
    const entry = await prisma.contentEntry.create({
      data: { type: "REAL_WEDDING", slug: uniqueSlug("cta"), status: "PUBLISHED", publishedAt: new Date() },
    })
    createdContentIds.push(entry.id)

    const payload = basePayload({ sourceForm: "vip-story-cta", sourceContentId: entry.id, subject: "Quiero una boda así" })
    const { response } = await post(payload)

    expect(response.status).toBe(201)
    const lead = await leadFor(payload.email)
    expect(lead?.requests[0].sourceContentId).toBe(entry.id)
    expect(lead?.requests[0].sourceForm).toBe("vip-story-cta")
  })

  itDb("descarta una ficha de origen inexistente pero guarda la solicitud", async () => {
    const payload = basePayload({ sourceForm: "vip-story-cta", sourceContentId: "ficha-que-no-existe" })
    const { response } = await post(payload)

    expect(response.status).toBe(201)
    const lead = await leadFor(payload.email)
    expect(lead?.requests).toHaveLength(1)
    expect(lead?.requests[0].sourceContentId).toBeNull()
  })

  itDb("descarta una ficha que no está publicada", async () => {
    const draft = await prisma.contentEntry.create({
      data: { type: "CATERING_EVENT", slug: uniqueSlug("borrador"), status: "DRAFT" },
    })
    createdContentIds.push(draft.id)

    const payload = basePayload({ sourceForm: "vip-story-cta", sourceContentId: draft.id })
    await post(payload)

    const lead = await leadFor(payload.email)
    expect(lead?.requests[0].sourceContentId).toBeNull()
  })
})

describe("POST /api/leads/requests — aviso por email", () => {
  const EMAIL_VARS = [
    "SENDGRID_API_KEY",
    "LEADS_FROM_EMAIL",
    "LEADS_NOTIFICATION_TO",
    "SEND_LEAD_ACKNOWLEDGEMENT",
  ] as const
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const name of EMAIL_VARS) original[name] = process.env[name]
  })

  afterEach(() => {
    for (const name of EMAIL_VARS) {
      if (original[name] === undefined) delete process.env[name]
      else process.env[name] = original[name]
    }
  })

  itDb("guarda la solicitud aunque no haya proveedor de correo configurado", async () => {
    for (const name of EMAIL_VARS) delete process.env[name]

    const payload = basePayload()
    const { response } = await post(payload)

    expect(response.status).toBe(201)
    expect((await leadFor(payload.email))?.requests).toHaveLength(1)
  })

  itDb("un fallo del envío de correo no afecta a lo que ya está guardado", async () => {
    // Proveedor configurado y respondiendo 500: el aviso falla de verdad.
    process.env.SENDGRID_API_KEY = "SG.clave-de-prueba"
    process.env.LEADS_FROM_EMAIL = "avisos@example.test"
    process.env.LEADS_NOTIFICATION_TO = "equipo@example.test"
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    vi.stubGlobal("fetch", fetchMock)

    try {
      const payload = basePayload()
      const { response, body } = await post(payload)

      // El visitante recibe su confirmación real, no un error prestado del correo.
      expect(response.status).toBe(201)
      expect(body.ok).toBe(true)
      expect((await leadFor(payload.email))?.requests).toHaveLength(1)
    } finally {
      vi.unstubAllGlobals()
    }

    // El estado del envío se comprueba en lib/notifications/*.test.ts: aquí el
    // aviso sale por `runAfterResponse`, así que su registro puede escribirse
    // después de que este test termine y afirmar sobre él sería intermitente.
  })
})

describe("POST /api/leads/requests — integridad del contacto ya guardado", () => {
  itDb("un nombre formado solo por caracteres de control se rechaza con 400", async () => {
    // Regresión. `.trim()` de JavaScript no considera espacio en blanco a los
    // caracteres de control, así que "\u0001\u0002" medía 2 y pasaba el `.min(1)`
    // del esquema. Después, el servidor los eliminaba antes de persistir y el campo
    // obligatorio acababa guardado como cadena vacía.
    const payload = basePayload({ firstName: "\u0001\u0002", lastName: "García" })

    const { response, body } = await post(payload)

    expect(response.status).toBe(400)
    expect(body.code).toBe("invalid-payload")
    expect(body.fields).toContain("firstName")
    // El error no devuelve el valor recibido, solo el nombre del campo.
    expect(JSON.stringify(body)).not.toContain("\u0001")
  })

  itDb("un envío no puede dejar sin nombre a un contacto que ya lo tenía", async () => {
    // El endpoint es público y no verifica el correo: quien conociese la dirección
    // de un contacto podía vaciar su ficha del CRM con un solo POST. La pérdida era
    // irreversible.
    const first = basePayload({ firstName: "Ana", lastName: "García" })
    expect((await post(first)).response.status).toBe(201)

    const saved = await leadFor(first.email)
    expect(saved?.firstName).toBe("Ana")

    // Segundo envío con el MISMO correo y nombres que el esquema aceptaría pero que
    // quedan vacíos al limpiarlos. Al estar rechazado en el borde, no llega a la
    // base; y si algún día llegara, la capa de dominio tampoco sobrescribiría.
    const attack = basePayload({
      email: first.email,
      firstName: "\u0001",
      lastName: "\u0001",
      submissionId: `sub-${randomBytes(8).toString("hex")}`,
    })
    const { response } = await post(attack, { ip: "198.18.0.240" })
    expect(response.status).toBe(400)

    const after = await leadFor(first.email)
    expect(after?.firstName).toBe("Ana")
    expect(after?.lastName).toBe("García")
  })
})
