import { describe, expect, it } from "vitest"
import { spacesContent } from "@/data/site-content"
import { eventTypeLabels } from "@/data/site-content"
import { eventTypeLabels as eventTypeLabelsEn } from "@/data/site-content.en"
import {
  BUDGET_RANGES,
  EVENT_TYPES,
  FIELD_LIMITS,
  MAX_GUEST_COUNT,
  NO_SPACE_PREFERENCE,
  PREFERRED_SPACES,
  isPlausibleEventDate,
  leadRequestFormSchema,
  leadRequestSchema,
  normalizeLeadRequest,
} from "@/lib/validation/lead-request"

/** Payload mínimo válido del endpoint. Cada test cambia solo lo que le interesa. */
function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Ana",
    lastName: "García",
    email: "ana@example.test",
    phone: "+34 600 111 222",
    eventType: "WEDDING",
    eventDate: "",
    guestCount: "",
    preferredSpace: "salon-porton",
    budgetRange: "",
    subject: "Boda en septiembre",
    message: "Nos gustaría visitar la finca.",
    privacyConsent: true,
    marketingConsent: false,
    policyVersion: "2026-08",
    sourcePage: "/",
    sourceForm: "contact-home",
    submissionId: "11111111-2222-3333-4444-555555555555",
    ...overrides,
  }
}

describe("vocabulario compartido", () => {
  it("los espacios seleccionables coinciden con los que publica la web", () => {
    // Si mañana se añade un salón a data/site-content.ts, este test avisa de que
    // el vocabulario del formulario se ha quedado atrás.
    expect(PREFERRED_SPACES).toEqual([...spacesContent.map((space) => space.slug), NO_SPACE_PREFERENCE])
  })

  it("cada tipo de evento tiene etiqueta en los dos idiomas", () => {
    for (const code of EVENT_TYPES) {
      expect(eventTypeLabels[code]).toBeTruthy()
      expect(eventTypeLabelsEn[code]).toBeTruthy()
    }
  })
})

describe("leadRequestSchema — solicitud válida", () => {
  it("acepta el payload mínimo", () => {
    const result = leadRequestSchema.safeParse(basePayload())
    expect(result.success).toBe(true)
  })

  it("acepta todos los campos opcionales rellenos", () => {
    const result = leadRequestSchema.safeParse(
      basePayload({
        eventDate: "2027-06-12",
        guestCount: "150",
        budgetRange: "20000-35000",
        preferredSpace: NO_SPACE_PREFERENCE,
        utmSource: "instagram",
        utmMedium: "social",
        utmCampaign: "verano",
        utmContent: "story",
        utmTerm: "finca bodas murcia",
        referrer: "https://www.instagram.com/",
        sourceContentId: "ckz1234567890",
      })
    )
    expect(result.success).toBe(true)
  })

  it("el esquema del formulario y el del endpoint comparten las reglas de campo", () => {
    // El formulario valida sin los campos de transporte; las reglas de contenido
    // son las mismas, así que un valor inválido lo rechazan los dos.
    const invalid = { ...basePayload({ email: "no-es-email" }) }
    expect(leadRequestFormSchema.safeParse(invalid).success).toBe(false)
    expect(leadRequestSchema.safeParse(invalid).success).toBe(false)
  })
})

describe("leadRequestSchema — consentimientos", () => {
  it("rechaza la solicitud si no se acepta la privacidad", () => {
    const result = leadRequestSchema.safeParse(basePayload({ privacyConsent: false }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "privacyConsent")).toBe(true)
    }
  })

  it("acepta marketing en false: no es obligatorio para enviar", () => {
    const result = leadRequestSchema.safeParse(basePayload({ marketingConsent: false }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(normalizeLeadRequest(result.data).marketingConsent).toBe(false)
    }
  })

  it("marketing ausente equivale a no concedido", () => {
    const payload = basePayload()
    delete (payload as Record<string, unknown>).marketingConsent
    const result = leadRequestSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(normalizeLeadRequest(result.data).marketingConsent).toBe(false)
    }
  })
})

describe("leadRequestSchema — fecha e invitados", () => {
  it("rechaza una fecha evidentemente pasada", () => {
    expect(leadRequestSchema.safeParse(basePayload({ eventDate: "2020-01-01" })).success).toBe(false)
  })

  it("acepta hoy como fecha del evento", () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(isPlausibleEventDate(today)).toBe(true)
  })

  it("rechaza el día anterior a hoy", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    expect(isPlausibleEventDate(yesterday)).toBe(false)
  })

  it("rechaza un día que no existe en el calendario", () => {
    expect(isPlausibleEventDate("2027-02-31")).toBe(false)
  })

  it("rechaza una fecha absurdamente lejana", () => {
    expect(leadRequestSchema.safeParse(basePayload({ eventDate: "2099-01-01" })).success).toBe(false)
  })

  it("rechaza un formato de fecha que no sea YYYY-MM-DD", () => {
    expect(leadRequestSchema.safeParse(basePayload({ eventDate: "12/06/2027" })).success).toBe(false)
  })

  it("rechaza invitados no enteros, cero, negativos o por encima del tope", () => {
    for (const guestCount of ["0", "-5", "12.5", String(MAX_GUEST_COUNT + 1), "muchos"]) {
      expect(leadRequestSchema.safeParse(basePayload({ guestCount })).success).toBe(false)
    }
  })

  it("acepta invitados como número y como cadena", () => {
    expect(leadRequestSchema.safeParse(basePayload({ guestCount: 120 })).success).toBe(true)
    expect(leadRequestSchema.safeParse(basePayload({ guestCount: "120" })).success).toBe(true)
  })
})

describe("leadRequestSchema — límites de longitud", () => {
  it("rechaza un mensaje por encima del límite", () => {
    const result = leadRequestSchema.safeParse(basePayload({ message: "x".repeat(FIELD_LIMITS.message + 1) }))
    expect(result.success).toBe(false)
  })

  it("rechaza un asunto por encima del límite", () => {
    expect(
      leadRequestSchema.safeParse(basePayload({ subject: "x".repeat(FIELD_LIMITS.subject + 1) })).success
    ).toBe(false)
  })

  it("acepta un mensaje justo en el límite", () => {
    expect(leadRequestSchema.safeParse(basePayload({ message: "x".repeat(FIELD_LIMITS.message) })).success).toBe(true)
  })
})

describe("leadRequestSchema — teléfono", () => {
  it("admite formatos habituales", () => {
    for (const phone of ["+34 600 11 22 33", "600112233", "(968) 13-98-00", "+34.600.112.233"]) {
      expect(leadRequestSchema.safeParse(basePayload({ phone })).success).toBe(true)
    }
  })

  it("rechaza texto que no es un teléfono", () => {
    for (const phone of ["llámame", "600<script>", "12"]) {
      expect(leadRequestSchema.safeParse(basePayload({ phone })).success).toBe(false)
    }
  })

  it("es opcional", () => {
    expect(leadRequestSchema.safeParse(basePayload({ phone: "" })).success).toBe(true)
  })
})

describe("leadRequestSchema — vocabulario cerrado", () => {
  it("rechaza un tipo de evento fuera de la lista", () => {
    expect(leadRequestSchema.safeParse(basePayload({ eventType: "CUMPLEANOS" })).success).toBe(false)
  })

  it("rechaza un espacio fuera de la lista", () => {
    expect(leadRequestSchema.safeParse(basePayload({ preferredSpace: "salon-inexistente" })).success).toBe(false)
  })

  it("rechaza un tramo de presupuesto fuera de la lista", () => {
    expect(leadRequestSchema.safeParse(basePayload({ budgetRange: "gratis" })).success).toBe(false)
    for (const budgetRange of BUDGET_RANGES) {
      expect(leadRequestSchema.safeParse(basePayload({ budgetRange })).success).toBe(true)
    }
  })

  it("rechaza un formulario de origen desconocido", () => {
    expect(leadRequestSchema.safeParse(basePayload({ sourceForm: "formulario-pirata" })).success).toBe(false)
  })

  it("rechaza un sourcePage que no sea una ruta interna", () => {
    for (const sourcePage of ["https://otro-dominio.example", "//otro-dominio.example", "contacto"]) {
      expect(leadRequestSchema.safeParse(basePayload({ sourcePage })).success).toBe(false)
    }
  })
})

describe("leadRequestSchema — eventos corporativos", () => {
  it("exige la empresa cuando el evento es corporativo", () => {
    const result = leadRequestSchema.safeParse(basePayload({ eventType: "CORPORATE_EVENT" }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "company")).toBe(true)
    }
  })

  it("acepta el evento corporativo con empresa", () => {
    const result = leadRequestSchema.safeParse(
      basePayload({ eventType: "CONGRESS", company: "Acme SL", jobTitle: "Directora", audiovisualNeeds: "Streaming" })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      const normalized = normalizeLeadRequest(result.data)
      expect(normalized.company).toBe("Acme SL")
      expect(normalized.jobTitle).toBe("Directora")
      expect(normalized.audiovisualNeeds).toBe("Streaming")
    }
  })

  it("descarta los campos de empresa cuando el evento no es corporativo", () => {
    const result = leadRequestSchema.safeParse(
      basePayload({ eventType: "WEDDING", company: "Acme SL", jobTitle: "Directora", audiovisualNeeds: "Streaming" })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      const normalized = normalizeLeadRequest(result.data)
      expect(normalized.company).toBeUndefined()
      expect(normalized.jobTitle).toBeUndefined()
      expect(normalized.audiovisualNeeds).toBeUndefined()
    }
  })
})

describe("normalizeLeadRequest", () => {
  it("convierte cadenas vacías en undefined y no en cadenas vacías", () => {
    const parsed = leadRequestSchema.parse(basePayload({ phone: "", eventDate: "", guestCount: "", budgetRange: "" }))
    const normalized = normalizeLeadRequest(parsed)

    expect(normalized.phone).toBeUndefined()
    expect(normalized.eventDate).toBeUndefined()
    expect(normalized.guestCount).toBeUndefined()
    expect(normalized.budgetRange).toBeUndefined()
  })

  it("convierte fecha e invitados a los tipos del dominio", () => {
    const parsed = leadRequestSchema.parse(basePayload({ eventDate: "2027-06-12", guestCount: "150" }))
    const normalized = normalizeLeadRequest(parsed)

    expect(normalized.guestCount).toBe(150)
    expect(normalized.eventDate?.toISOString().slice(0, 10)).toBe("2027-06-12")
  })

  it("no transforma el texto libre: lo guarda tal como se escribió", () => {
    const message = 'Queremos <script>alert("hola")</script> & "comillas"'
    const parsed = leadRequestSchema.parse(basePayload({ message }))
    expect(normalizeLeadRequest(parsed).message).toBe(message)
  })

  it("recorta los espacios sobrantes de los extremos", () => {
    const parsed = leadRequestSchema.parse(basePayload({ firstName: "  Ana  ", email: " ana@example.test " }))
    const normalized = normalizeLeadRequest(parsed)
    expect(normalized.firstName).toBe("Ana")
    expect(normalized.email).toBe("ana@example.test")
  })
})
