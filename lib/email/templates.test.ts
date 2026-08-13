import { describe, expect, it } from "vitest"
import {
  buildLeadAcknowledgement,
  buildLeadRequestNotification,
  buildOverdueTasksDigest,
  buildVipVerificationEmail,
} from "@/lib/email/templates"
import type { Lead, LeadRequest } from "@prisma/client"

const SITE = "https://elportondelacondesa.com"

const lead = {
  id: "lead-1",
  email: "ana.garcia@example.test",
  firstName: "Ana",
  lastName: "García",
  phone: "+34600112233",
} as Lead

const request = {
  id: "req-1",
  eventType: "WEDDING",
  eventDate: new Date("2027-06-12T12:00:00.000Z"),
  guestCount: 150,
  preferredSpace: "salon-porton",
  budgetRange: "20000-35000",
  subject: "Boda en septiembre",
  message: "Queremos algo rústico",
  company: null,
  jobTitle: null,
  audiovisualNeeds: null,
  sourceForm: "contact-home",
  sourcePage: "/",
} as LeadRequest

describe("plantilla del aviso interno", () => {
  it("enlaza al detalle protegido del CRM y sin token", () => {
    const content = buildLeadRequestNotification(lead, request, SITE)

    expect(content.html).toContain(`${SITE}/admin/solicitudes/${request.id}`)
    expect(content.text).toContain(`${SITE}/admin/solicitudes/${request.id}`)

    // Un enlace con token en un correo es un acceso permanente para cualquiera que
    // reenvíe el mensaje. Aquí no hace falta: el equipo inicia sesión.
    for (const suspicious of ["token=", "?t=", "access=", "key=", "secret"]) {
      expect(content.html).not.toContain(suspicious)
    }
    expect(content.html).toContain("iniciar sesión")
  })

  it("traduce los códigos a etiquetas legibles", () => {
    const content = buildLeadRequestNotification(lead, request, SITE)
    expect(content.html).toContain("Boda")
    expect(content.html).toContain("Salón Portón")
    expect(content.text).toContain("Tipo de evento: Boda")
  })

  it("escapa el texto libre: aquí no hay JSX que lo haga", () => {
    const hostile = { ...request, message: '<script>alert("x")</script>', subject: 'Boda & "fiesta"' } as LeadRequest
    const content = buildLeadRequestNotification(lead, hostile, SITE)

    expect(content.html).not.toContain("<script>")
    expect(content.html).toContain("&lt;script&gt;")
    expect(content.html).toContain("&amp;")
  })

  it("omite las filas sin valor en vez de mostrarlas vacías", () => {
    const content = buildLeadRequestNotification({ ...lead, phone: null } as Lead, request, SITE)
    expect(content.html).not.toContain("Teléfono")
    expect(content.html).not.toContain("Empresa")
  })
})

describe("plantilla del acuse al visitante", () => {
  it("sin consentimiento de marketing solo confirma la recepción", () => {
    const content = buildLeadAcknowledgement(lead, request, { includeMarketing: false })

    expect(content.html).toContain("Hemos recibido tu solicitud")
    expect(content.html).toContain("confirma que tu solicitud llegó correctamente")

    // Nada promocional: un acuse transaccional no puede convertirse en un envío
    // comercial no consentido.
    for (const marketing of ["novedades", "comunicaciones comerciales", "suscríb", "oferta", "descuento"]) {
      expect(content.html.toLowerCase()).not.toContain(marketing)
      expect(content.text.toLowerCase()).not.toContain(marketing)
    }
  })

  it("con consentimiento añade la parte comercial y cómo dejar de recibirla", () => {
    const content = buildLeadAcknowledgement(lead, request, { includeMarketing: true })

    expect(content.html).toContain("comunicaciones comerciales")
    expect(content.html.toLowerCase()).toContain("dejemos de hacerlo")
  })

  it("no promete plazos ni compromisos que nadie ha aprobado", () => {
    const content = buildLeadAcknowledgement(lead, request, { includeMarketing: false })
    for (const promise of ["24 horas", "48 horas", "en el día", "inmediatamente", "garantiz"]) {
      expect(content.text.toLowerCase()).not.toContain(promise)
    }
  })

  it("saluda por el nombre si lo hay, y de forma neutra si no", () => {
    expect(buildLeadAcknowledgement(lead, request, { includeMarketing: false }).text).toContain("Hola Ana,")
    expect(
      buildLeadAcknowledgement({ ...lead, firstName: null } as Lead, request, { includeMarketing: false }).text
    ).toContain("Hola,")
  })

  it("no incluye el enlace al panel: el visitante no tiene nada que hacer ahí", () => {
    const content = buildLeadAcknowledgement(lead, request, { includeMarketing: false })
    expect(content.html).not.toContain("/admin")
  })
})

describe("accesibilidad y forma de todas las plantillas", () => {
  const all = [
    buildLeadRequestNotification(lead, request, SITE),
    buildLeadAcknowledgement(lead, request, { includeMarketing: false }),
    buildOverdueTasksDigest(
      [
        {
          id: "task-1",
          title: "Llamar a Ana",
          dueAt: new Date("2027-01-01T12:00:00.000Z"),
          leadId: lead.id,
          leadLabel: "Ana García",
          assigneeName: "Comercial",
        },
      ],
      SITE
    ),
    buildVipVerificationEmail(`${SITE}/vip/verificar?token=abc`),
  ]

  it("todas traen alternativa en texto plano", () => {
    for (const content of all) {
      expect(content.text.trim().length).toBeGreaterThan(20)
      expect(content.text).not.toContain("<")
    }
  })

  it("todas declaran idioma, viewport y un h1 real", () => {
    for (const content of all) {
      expect(content.html).toContain('<html lang="es">')
      expect(content.html).toContain('name="viewport"')
      expect(content.html).toContain("<h1")
    }
  })

  it("las tablas de maquetación se marcan como presentación, para que no se anuncien como datos", () => {
    for (const content of all) {
      const layoutTables = content.html.match(/<table role="presentation"/g) ?? []
      expect(layoutTables.length).toBeGreaterThan(0)
    }
  })

  it("las tablas de datos usan encabezados de fila", () => {
    const withData = buildLeadRequestNotification(lead, request, SITE)
    expect(withData.html).toContain('<th scope="row"')
  })

  it("se adaptan al ancho del cliente sin media queries", () => {
    for (const content of all) {
      expect(content.html).toContain("max-width:600px")
    }
  })

  it("ninguna depende de imágenes externas", () => {
    for (const content of all) {
      expect(content.html).not.toContain("<img")
    }
  })

  it("todas tienen asunto con contenido", () => {
    for (const content of all) {
      expect(content.subject.trim().length).toBeGreaterThan(5)
    }
  })
})

describe("resumen de tareas vencidas", () => {
  it("lista las tareas y enlaza a la vista de vencidas", () => {
    const content = buildOverdueTasksDigest(
      [
        {
          id: "t1",
          title: "Llamar a Ana",
          dueAt: new Date("2027-01-01T12:00:00.000Z"),
          leadId: "lead-1",
          leadLabel: "Ana García",
          assigneeName: null,
        },
        {
          id: "t2",
          title: "Enviar propuesta",
          dueAt: new Date("2027-01-02T12:00:00.000Z"),
          leadId: "lead-2",
          leadLabel: "Otro contacto",
          assigneeName: "Comercial",
        },
      ],
      SITE
    )

    expect(content.subject).toContain("2 tareas vencidas")
    expect(content.html).toContain("Llamar a Ana")
    expect(content.html).toContain("Enviar propuesta")
    expect(content.html).toContain(`${SITE}/admin/tareas?vista=vencidas`)
    expect(content.html).toContain("sin asignar")
  })

  it("usa el singular con una sola tarea", () => {
    const content = buildOverdueTasksDigest(
      [{ id: "t1", title: "Una", dueAt: new Date(), leadId: "l", leadLabel: "X", assigneeName: null }],
      SITE
    )
    expect(content.subject).toContain("1 tarea vencida")
  })
})

describe("verificación VIP (preparada, no activa)", () => {
  it("incluye el enlace de verificación tal cual", () => {
    const url = `${SITE}/vip/verificar?token=abc123`
    const content = buildVipVerificationEmail(url)

    expect(content.html).toContain(url)
    expect(content.text).toContain(url)
    expect(content.html.toLowerCase()).toContain("confirma tu email")
  })

  it("avisa a quien no lo haya pedido de que puede ignorarlo", () => {
    const content = buildVipVerificationEmail(`${SITE}/vip/verificar?token=abc`)
    expect(content.text.toLowerCase()).toContain("ignorar")
  })
})
