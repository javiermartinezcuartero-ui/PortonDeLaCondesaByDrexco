import { afterAll, afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { createLeadRequest } from "@/lib/domain/lead-requests"
import { recalculateLeadScore } from "@/lib/domain/scoring"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

/**
 * Puntuación de contactos.
 *
 * **Todas las pruebas que dependen de los pesos viven en este archivo, y es una
 * decisión, no una casualidad.** `ScoringRule` es una tabla de configuración global:
 * una fila por señal, compartida por todo el sistema. Las pruebas de aquí la
 * modifican —fijan puntos, desactivan una regla— y Vitest ejecuta los **archivos**
 * en paralelo contra una única base de desarrollo, pero los **tests de un mismo
 * archivo** en serie.
 *
 * Mientras la prueba de idempotencia estuvo en `crm.test.ts`, esa combinación
 * producía el fallo intermitente que la auditoría final no consiguió reproducir:
 * `expected 40 to be 30`, porque entre el primer recálculo y el segundo esta suite
 * reactivaba `FORM_SUBMITTED` y sus 10 puntos volvían a contar. Juntarlas aquí
 * elimina la carrera; la solución de fondo —una base por archivo— sigue pendiente
 * (README §Limitaciones).
 *
 * Corolario para quien añada pruebas: **cualquier prueba nueva que dependa de los
 * pesos va en este archivo.** En otro, vuelve el intermitente.
 */

const createdLeadIds: string[] = []
const createdContentIds: string[] = []

afterEach(async () => {
  if (createdLeadIds.length) {
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } })
    createdLeadIds.length = 0
  }
  if (createdContentIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdContentIds } } })
    createdContentIds.length = 0
  }
})

/**
 * Deja la configuración como estaba.
 *
 * Estas pruebas cambian pesos globales, así que sin esto la base de desarrollo se
 * quedaría con la configuración de la última que corriera, y el panel mostraría
 * puntuaciones distintas a las del seed sin que nadie hubiera tocado nada.
 */
const SEED_POINTS: Record<string, number> = {
  FORM_SUBMITTED: 10,
  PHONE_PROVIDED: 10,
  EVENT_DATE_PROVIDED: 10,
}

afterAll(async () => {
  for (const [key, points] of Object.entries(SEED_POINTS)) {
    await prisma.scoringRule.updateMany({ where: { key }, data: { points, active: true } })
  }
})

/** Contacto con teléfono, del tipo que usa la prueba de idempotencia. */
async function createScoredLead(email: string) {
  const { lead } = await createLeadRequest({
    email,
    phone: "+34600112233",
    eventType: "boda",
    eventDate: new Date("2027-06-12T12:00:00.000Z"),
    guestCount: 120,
  })
  createdLeadIds.push(lead.id)
  return lead
}

describe("recalculateLeadScore", () => {
  itDb("suma los pesos de las señales presentes según scoring_rule", async () => {
    await prisma.scoringRule.upsert({
      where: { key: "FORM_SUBMITTED" },
      create: { key: "FORM_SUBMITTED", label: "Formulario enviado", points: 10 },
      update: { points: 10, active: true },
    })
    await prisma.scoringRule.upsert({
      where: { key: "PHONE_PROVIDED" },
      create: { key: "PHONE_PROVIDED", label: "Teléfono informado", points: 10 },
      update: { points: 10, active: true },
    })
    await prisma.scoringRule.upsert({
      where: { key: "EVENT_DATE_PROVIDED" },
      create: { key: "EVENT_DATE_PROVIDED", label: "Fecha informada", points: 10 },
      update: { points: 10, active: true },
    })

    const email = uniqueTestEmail("scoring")
    const { lead } = await createLeadRequest({
      email,
      phone: "619865403",
      eventType: "boda",
      eventDate: new Date("2027-06-01"),
    })
    createdLeadIds.push(lead.id)

    const score = await recalculateLeadScore(lead.id)

    // FORM_SUBMITTED (10) + PHONE_PROVIDED (10) + EVENT_DATE_PROVIDED (10) = 30
    expect(score).toBe(30)

    const updatedLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(updatedLead.score).toBe(30)
  })

  itDb("una regla desactivada no suma puntos", async () => {
    await prisma.scoringRule.upsert({
      where: { key: "FORM_SUBMITTED" },
      create: { key: "FORM_SUBMITTED", label: "Formulario enviado", points: 10, active: false },
      update: { active: false },
    })

    const email = uniqueTestEmail("scoring-inactivo")
    const { lead } = await createLeadRequest({ email, eventType: "boda" })
    createdLeadIds.push(lead.id)

    const score = await recalculateLeadScore(lead.id)
    expect(score).toBe(0)

    // Deja la regla reactivada para no afectar a otros tests/al seed real.
    await prisma.scoringRule.update({ where: { key: "FORM_SUBMITTED" }, data: { active: true } })
  })
})

describe("scoring", () => {
  itDb("es idempotente: recalcular dos veces da el mismo número", async () => {
    const lead = await createScoredLead(uniqueTestEmail("idempotente"))

    const first = await recalculateLeadScore(lead.id)
    const second = await recalculateLeadScore(lead.id)
    const third = await recalculateLeadScore(lead.id)

    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(first).toBeGreaterThan(0)
  })

  itDb("el mismo hito no suma dos veces aunque se repita", async () => {
    const lead = await createScoredLead(uniqueTestEmail("hito-unico"))
    const withOneRequest = await recalculateLeadScore(lead.id)

    // Una segunda solicitud es más actividad, pero "ha enviado un formulario"
    // sigue siendo un único hito cumplido.
    await createLeadRequest({ email: lead.email, subject: "Segunda consulta", eventType: "boda" })
    const withTwoRequests = await recalculateLeadScore(lead.id)

    expect(withTwoRequests).toBe(withOneRequest)
  })

  itDb("tres fichas distintas suman una sola vez, y dos no suman", async () => {
    const twoViews = await createScoredLead(uniqueTestEmail("dos-fichas"))
    const threeViews = await createScoredLead(uniqueTestEmail("tres-fichas"))

    const entries = await Promise.all(
      [1, 2, 3].map(() =>
        prisma.contentEntry.create({ data: { type: "REAL_WEDDING", slug: `score-${Math.random().toString(36).slice(2, 10)}`, status: "PUBLISHED" } })
      )
    )
    for (const entry of entries) createdContentIds.push(entry.id)

    for (const entry of entries.slice(0, 2)) {
      await prisma.contentInteraction.create({
        data: { leadId: twoViews.id, contentEntryId: entry.id, section: "REAL_WEDDING", type: "CONTENT_VIEWED" },
      })
    }
    for (const entry of entries) {
      await prisma.contentInteraction.create({
        data: { leadId: threeViews.id, contentEntryId: entry.id, section: "REAL_WEDDING", type: "CONTENT_VIEWED" },
      })
    }
    // Repetir la misma ficha no cuenta como una ficha más.
    await prisma.contentInteraction.create({
      data: { leadId: threeViews.id, contentEntryId: entries[0].id, section: "REAL_WEDDING", type: "CONTENT_VIEWED" },
    })

    const rule = await prisma.scoringRule.findUnique({ where: { key: "CONTENT_VIEWED_3PLUS" } })
    const weight = rule?.active ? rule.points : 0

    const twoScore = await recalculateLeadScore(twoViews.id)
    const threeScore = await recalculateLeadScore(threeViews.id)

    expect(threeScore - twoScore).toBe(weight)
  })
})
