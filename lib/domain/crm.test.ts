import { randomBytes } from "node:crypto"
import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { itDb, uniqueSlug, uniqueTestEmail } from "@/lib/domain/test-helpers"
import { listLeadsForAdmin } from "@/lib/domain/crm-leads"
import {
  archiveRequest,
  findPossibleDuplicates,
  listRequestsForAdmin,
  updateRequestDetails,
} from "@/lib/domain/crm-requests"
import { exportLeadsCsv, exportRequestsCsv } from "@/lib/domain/crm-export"
import { changeLeadRequestStatus } from "@/lib/domain/lead-requests"
import { InvalidTransitionError, DomainError } from "@/lib/domain/errors"
import { addLeadNote, updateLeadNote } from "@/lib/domain/notes"
import { recalculateLeadScore } from "@/lib/domain/scoring"
import { cancelFollowUpTask, completeFollowUpTask, createFollowUpTask, listTasks } from "@/lib/domain/tasks"
import {
  acquisitionFunnel,
  averageHoursToFirstContact,
  conversionOverClosed,
  countRequestsByStatus,
  identifiedToRequestRatio,
} from "@/lib/domain/metrics"

/**
 * Pruebas del CRM contra la base de datos real de desarrollo (ver
 * docs/arquitectura-backend.md §5). Cada test crea sus propios datos con
 * identificadores únicos y los borra al terminar, para poder correr sobre una
 * base compartida sin pisar nada.
 */

const createdEmails: string[] = []
const createdUserIds: string[] = []
const createdContentIds: string[] = []

afterEach(async () => {
  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
  if (createdContentIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdContentIds } } })
    createdContentIds.length = 0
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

async function createLead(overrides: Record<string, unknown> = {}) {
  const email = uniqueTestEmail("crm")
  createdEmails.push(email.toLowerCase())
  return prisma.lead.create({
    data: {
      email,
      emailNormalized: email.toLowerCase(),
      firstName: "Ana",
      lastName: "García",
      lastActivityAt: new Date(),
      ...overrides,
    },
  })
}

async function createRequest(leadId: string, overrides: Record<string, unknown> = {}) {
  return prisma.leadRequest.create({
    data: {
      leadId,
      eventType: "WEDDING",
      subject: "Boda en septiembre",
      message: "Queremos visitar la finca",
      ...overrides,
    },
  })
}

async function createUser(role: "ADMIN" | "SALES" = "SALES") {
  const user = await prisma.user.create({
    data: { name: `Comercial ${randomBytes(3).toString("hex")}`, email: uniqueTestEmail("user"), role },
  })
  createdUserIds.push(user.id)
  return user
}

// ---------------------------------------------------------------------------
// Filtros y paginación
// ---------------------------------------------------------------------------

describe("listLeadsForAdmin — búsqueda y filtros", () => {
  itDb("encuentra por email aunque se busque con otras mayúsculas", async () => {
    const lead = await createLead()
    const { leads } = await listLeadsForAdmin({ search: lead.email.toUpperCase() })
    expect(leads.map((row) => row.id)).toContain(lead.id)
  })

  itDb("encuentra por teléfono escrito de otra forma", async () => {
    // Se guarda normalizado (+34600112233) y se busca con espacios: el término
    // pasa por el mismo normalizador, así que casa.
    const lead = await createLead({ phone: "600 11 22 33", phoneNormalized: "+34600112233" })
    const { leads } = await listLeadsForAdmin({ search: "600 11 22 33" })
    expect(leads.map((row) => row.id)).toContain(lead.id)
  })

  itDb("filtra por puntuación mínima", async () => {
    const low = await createLead({ score: 5 })
    const high = await createLead({ score: 40 })

    const { leads } = await listLeadsForAdmin({ minScore: 30 })
    const ids = leads.map((row) => row.id)
    expect(ids).toContain(high.id)
    expect(ids).not.toContain(low.id)
  })

  itDb("filtra por consentimiento de marketing", async () => {
    // Se acota la búsqueda al nombre propio de este test: el listado pagina y otros
    // archivos crean contactos con consentimiento en paralelo, así que sin acotar
    // las filas podrían quedar fuera de la primera página.
    const marker = `marketing-${randomBytes(4).toString("hex")}`
    const withConsent = await createLead({ firstName: marker })
    const without = await createLead({ firstName: marker })
    await prisma.consentEvent.create({
      data: { leadId: withConsent.id, purpose: "MARKETING", granted: true, policyVersion: "2026-08" },
    })

    const granted = await listLeadsForAdmin({ marketingConsent: true, search: marker })
    expect(granted.leads.map((row) => row.id)).toEqual([withConsent.id])

    const notGranted = await listLeadsForAdmin({ marketingConsent: false, search: marker })
    expect(notGranted.leads.map((row) => row.id)).toEqual([without.id])
  })

  itDb("pagina en servidor sin traer más filas de las pedidas", async () => {
    const first = await listLeadsForAdmin({ page: 1, pageSize: 2 })
    expect(first.leads.length).toBeLessThanOrEqual(2)
    expect(first.pageSize).toBe(2)
    expect(first.totalPages).toBe(Math.max(1, Math.ceil(first.total / 2)))
  })

  itDb("una página fuera de rango devuelve vacío, no la primera", async () => {
    const { leads } = await listLeadsForAdmin({ page: 9_999, pageSize: 5 })
    expect(leads).toHaveLength(0)
  })
})

describe("listRequestsForAdmin — filtros", () => {
  itDb("filtra por estado, prioridad y responsable", async () => {
    const lead = await createLead()
    const user = await createUser()
    // Los tests corren contra la base de desarrollo compartida y el listado
    // pagina: sin un marcador propio en el asunto, las filas de este test podrían
    // quedar fuera de la primera página por culpa de datos de otro test.
    const marker = uniqueSlug("filtro")
    const target = await createRequest(lead.id, {
      status: "QUALIFIED",
      priority: "HIGH",
      ownerId: user.id,
      subject: `${marker}-asignada`,
    })
    const other = await createRequest(lead.id, { status: "NEW", priority: "LOW", subject: `${marker}-libre` })

    const byStatus = await listRequestsForAdmin({ status: "QUALIFIED", search: marker })
    expect(byStatus.requests.map((row) => row.id)).toEqual([target.id])

    const byPriority = await listRequestsForAdmin({ priority: "HIGH", search: marker })
    expect(byPriority.requests.map((row) => row.id)).toEqual([target.id])

    const byOwner = await listRequestsForAdmin({ ownerId: user.id })
    expect(byOwner.requests.map((row) => row.id)).toEqual([target.id])

    const unassigned = await listRequestsForAdmin({ unassigned: true, status: "NEW", search: marker })
    expect(unassigned.requests.map((row) => row.id)).toEqual([other.id])
  })

  itDb("filtra por rango de invitados", async () => {
    const lead = await createLead()
    const marker = uniqueSlug("invitados")
    const small = await createRequest(lead.id, { guestCount: 40, subject: `${marker}-pocos` })
    const big = await createRequest(lead.id, { guestCount: 300, subject: `${marker}-muchos` })

    const { requests } = await listRequestsForAdmin({ minGuests: 100, maxGuests: 500, search: marker })
    const ids = requests.map((row) => row.id)
    expect(ids).toEqual([big.id])
    expect(ids).not.toContain(small.id)
  })

  itDb("filtra por ficha de origen", async () => {
    const lead = await createLead()
    const entry = await prisma.contentEntry.create({
      data: { type: "REAL_WEDDING", slug: uniqueSlug("crm"), status: "PUBLISHED" },
    })
    createdContentIds.push(entry.id)
    const fromContent = await createRequest(lead.id, { sourceContentId: entry.id })
    const direct = await createRequest(lead.id)

    const { requests } = await listRequestsForAdmin({ sourceContentId: entry.id })
    const ids = requests.map((row) => row.id)
    expect(ids).toContain(fromContent.id)
    expect(ids).not.toContain(direct.id)
  })

  itDb("una solicitud archivada desaparece de los listados", async () => {
    const lead = await createLead()
    const user = await createUser("ADMIN")
    const request = await createRequest(lead.id)

    await archiveRequest(request.id, user.id)

    const { requests } = await listRequestsForAdmin({})
    expect(requests.map((row) => row.id)).not.toContain(request.id)
    // Pero sigue existiendo: archivar no borra.
    expect(await prisma.leadRequest.findUnique({ where: { id: request.id } })).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

describe("changeLeadRequestStatus", () => {
  itDb("registra actividad y auditoría en la misma transacción", async () => {
    const lead = await createLead()
    const user = await createUser()
    const request = await createRequest(lead.id)

    await changeLeadRequestStatus({ leadRequestId: request.id, nextStatus: "CONTACTED", actorId: user.id })

    const activity = await prisma.leadActivity.findFirst({
      where: { leadRequestId: request.id, type: "STATUS_CHANGED" },
    })
    expect(activity).not.toBeNull()
    expect((activity?.metadata as { to?: string })?.to).toBe("CONTACTED")

    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "LeadRequest", entityId: request.id, action: "request.status" },
    })
    expect(audit).not.toBeNull()
    expect(audit?.actorId).toBe(user.id)
  })

  itDb("rechaza una transición que la máquina de estados no permite", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id, { status: "NEW" })

    // NEW solo puede ir a CONTACTED o LOST.
    await expect(
      changeLeadRequestStatus({ leadRequestId: request.id, nextStatus: "WON" })
    ).rejects.toThrow(InvalidTransitionError)

    const unchanged = await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(unchanged.status).toBe("NEW")
  })

  itDb("WON es terminal: no admite ningún movimiento posterior", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id, { status: "NEGOTIATION" })
    await changeLeadRequestStatus({ leadRequestId: request.id, nextStatus: "WON" })

    await expect(changeLeadRequestStatus({ leadRequestId: request.id, nextStatus: "LOST", lostReason: "x" })).rejects.toThrow(
      InvalidTransitionError
    )
  })

  itDb("no se puede marcar como perdida sin motivo", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)

    await expect(changeLeadRequestStatus({ leadRequestId: request.id, nextStatus: "LOST" })).rejects.toThrow(DomainError)
    await expect(
      changeLeadRequestStatus({ leadRequestId: request.id, nextStatus: "LOST", lostReason: "   " })
    ).rejects.toThrow(DomainError)

    const unchanged = await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(unchanged.status).toBe("NEW")
    expect(unchanged.lostReason).toBeNull()
  })

  itDb("guarda el motivo al perder y no lo duplica en la auditoría", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)

    await changeLeadRequestStatus({
      leadRequestId: request.id,
      nextStatus: "LOST",
      lostReason: "Eligió otra finca por precio",
    })

    const lost = await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(lost.status).toBe("LOST")
    expect(lost.lostReason).toBe("Eligió otra finca por precio")

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: request.id, action: "request.status" },
      orderBy: { createdAt: "desc" },
    })
    expect(JSON.stringify(audit.metadata)).not.toContain("otra finca")
    expect((audit.metadata as { motivoLongitud?: number }).motivoLongitud).toBeGreaterThan(0)
  })

  itDb("mover al mismo estado no crea ruido en el historial", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id, { status: "CONTACTED" })

    await changeLeadRequestStatus({ leadRequestId: request.id, nextStatus: "CONTACTED" })

    expect(await prisma.leadActivity.count({ where: { leadRequestId: request.id, type: "STATUS_CHANGED" } })).toBe(0)
  })
})

describe("updateRequestDetails", () => {
  itDb("asigna responsable y anota el cambio en el historial", async () => {
    const lead = await createLead()
    const actor = await createUser("ADMIN")
    const owner = await createUser()
    const request = await createRequest(lead.id)

    await updateRequestDetails({
      id: request.id,
      actorId: actor.id,
      priority: "HIGH",
      ownerId: owner.id,
      nextActionAt: new Date("2027-06-12T12:00:00.000Z"),
      preferredSpace: "salon-porton",
      budgetRange: "20000-35000",
    })

    const updated = await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(updated.ownerId).toBe(owner.id)
    expect(updated.priority).toBe("HIGH")
    expect(updated.preferredSpace).toBe("salon-porton")

    const activity = await prisma.leadActivity.findFirst({
      where: { leadRequestId: request.id, type: "NOTE" },
    })
    expect((activity?.metadata as { accion?: string })?.accion).toBe("asignacion")
  })

  itDb("rechaza un responsable que no existe", async () => {
    const lead = await createLead()
    const actor = await createUser("ADMIN")
    const request = await createRequest(lead.id)

    await expect(
      updateRequestDetails({
        id: request.id,
        actorId: actor.id,
        priority: "NORMAL",
        ownerId: "usuario-inexistente",
        nextActionAt: null,
        preferredSpace: null,
        budgetRange: null,
      })
    ).rejects.toThrow(DomainError)
  })

  itDb("no toca el mensaje ni el asunto que escribió la persona", async () => {
    const lead = await createLead()
    const actor = await createUser("ADMIN")
    const request = await createRequest(lead.id, { subject: "Mi asunto", message: "Mi mensaje" })

    await updateRequestDetails({
      id: request.id,
      actorId: actor.id,
      priority: "URGENT",
      ownerId: null,
      nextActionAt: null,
      preferredSpace: null,
      budgetRange: null,
    })

    const updated = await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(updated.subject).toBe("Mi asunto")
    expect(updated.message).toBe("Mi mensaje")
  })
})

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

describe("tareas", () => {
  itDb("crear una tarea deja constancia en el historial del contacto", async () => {
    const lead = await createLead()
    const actor = await createUser()
    const request = await createRequest(lead.id)

    const task = await createFollowUpTask({
      leadId: lead.id,
      leadRequestId: request.id,
      title: "Llamar para confirmar la visita",
      dueAt: new Date("2027-06-12T12:00:00.000Z"),
      actorId: actor.id,
    })

    expect(task.status).toBe("PENDING")
    const activity = await prisma.leadActivity.findFirst({
      where: { leadId: lead.id, leadRequestId: request.id, type: "NOTE" },
    })
    expect((activity?.metadata as { accion?: string })?.accion).toBe("tarea-creada")
  })

  itDb("completar registra actividad y marca la fecha", async () => {
    const lead = await createLead()
    const actor = await createUser()
    const task = await createFollowUpTask({ leadId: lead.id, title: "Enviar propuesta", dueAt: new Date() })

    const completed = await completeFollowUpTask(task.id, actor.id)
    expect(completed.status).toBe("COMPLETED")
    expect(completed.completedAt).not.toBeNull()

    const activities = await prisma.leadActivity.findMany({ where: { leadId: lead.id } })
    expect(activities.some((a) => (a.metadata as { accion?: string })?.accion === "tarea-completada")).toBe(true)
  })

  itDb("cancelar conserva la tarea y su historial, no la borra", async () => {
    const lead = await createLead()
    const task = await createFollowUpTask({ leadId: lead.id, title: "Descartada", dueAt: new Date() })

    await cancelFollowUpTask(task.id)

    const cancelled = await prisma.followUpTask.findUnique({ where: { id: task.id } })
    expect(cancelled).not.toBeNull()
    expect(cancelled?.status).toBe("CANCELLED")
    // Cancelar no es completar: no se inventa una fecha de finalización.
    expect(cancelled?.completedAt).toBeNull()
  })

  itDb("una tarea cerrada no se puede reabrir ni editar", async () => {
    const lead = await createLead()
    const task = await createFollowUpTask({ leadId: lead.id, title: "Cerrada", dueAt: new Date() })
    await completeFollowUpTask(task.id)

    await expect(cancelFollowUpTask(task.id)).rejects.toThrow(DomainError)
  })

  itDb("rechaza una tarea ligada a una solicitud de otro contacto", async () => {
    const lead = await createLead()
    const otherLead = await createLead()
    const foreignRequest = await createRequest(otherLead.id)

    await expect(
      createFollowUpTask({
        leadId: lead.id,
        leadRequestId: foreignRequest.id,
        title: "No debería poder crearse",
        dueAt: new Date(),
      })
    ).rejects.toThrow(DomainError)
  })

  itDb("la vista de vencidas solo trae pendientes con fecha pasada", async () => {
    const lead = await createLead()
    const viewer = await createUser()
    const overdue = await createFollowUpTask({
      leadId: lead.id,
      title: "Vencida de prueba",
      dueAt: new Date("2020-01-01T12:00:00.000Z"),
      assigneeId: viewer.id,
    })
    const future = await createFollowUpTask({
      leadId: lead.id,
      title: "Futura de prueba",
      dueAt: new Date("2099-01-01T12:00:00.000Z"),
      assigneeId: viewer.id,
    })

    const { tasks } = await listTasks("vencidas", viewer.id, new Date())
    const ids = tasks.map((task) => task.id)
    expect(ids).toContain(overdue.id)
    expect(ids).not.toContain(future.id)
  })

  itDb("la vista mías solo trae las asignadas a quien mira", async () => {
    const lead = await createLead()
    const viewer = await createUser()
    const other = await createUser()
    const mine = await createFollowUpTask({ leadId: lead.id, title: "Mía", dueAt: new Date(), assigneeId: viewer.id })
    const theirs = await createFollowUpTask({ leadId: lead.id, title: "De otro", dueAt: new Date(), assigneeId: other.id })

    const { tasks } = await listTasks("mias", viewer.id, new Date())
    const ids = tasks.map((task) => task.id)
    expect(ids).toContain(mine.id)
    expect(ids).not.toContain(theirs.id)
  })
})

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------

describe("notas", () => {
  itDb("guarda el texto tal cual, sin interpretar etiquetas", async () => {
    const lead = await createLead()
    const author = await createUser()
    const body = 'Dijo que quería <b>algo así</b> & con photocall'

    const note = await addLeadNote({ leadId: lead.id, body, authorId: author.id })
    expect(note.body).toBe(body)
  })

  itDb("rechaza una nota vacía y una por encima del límite", async () => {
    const lead = await createLead()
    await expect(addLeadNote({ leadId: lead.id, body: "   " })).rejects.toThrow(DomainError)
    await expect(addLeadNote({ leadId: lead.id, body: "x".repeat(4_001) })).rejects.toThrow(DomainError)
  })

  itDb("editar una nota queda auditado sin copiar su contenido", async () => {
    const lead = await createLead()
    const author = await createUser()
    const note = await addLeadNote({ leadId: lead.id, body: "Versión inicial", authorId: author.id })

    await updateLeadNote({ id: note.id, body: "Versión corregida con un dato sensible", actorId: author.id })

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "LeadNote", entityId: note.id, action: "note.update" },
    })
    expect(audit.actorId).toBe(author.id)
    expect(JSON.stringify(audit.metadata)).not.toContain("dato sensible")

    const updated = await prisma.leadNote.findUniqueOrThrow({ where: { id: note.id } })
    expect(updated.body).toBe("Versión corregida con un dato sensible")
  })
})

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe("scoring", () => {
  itDb("es idempotente: recalcular dos veces da el mismo número", async () => {
    const lead = await createLead({ phone: "+34600112233", phoneNormalized: "+34600112233" })
    await createRequest(lead.id, { eventDate: new Date("2027-06-12T12:00:00.000Z"), guestCount: 120 })

    const first = await recalculateLeadScore(lead.id)
    const second = await recalculateLeadScore(lead.id)
    const third = await recalculateLeadScore(lead.id)

    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(first).toBeGreaterThan(0)
  })

  itDb("el mismo hito no suma dos veces aunque se repita", async () => {
    const lead = await createLead()
    await createRequest(lead.id)
    const withOneRequest = await recalculateLeadScore(lead.id)

    // Una segunda solicitud es más actividad, pero "ha enviado un formulario"
    // sigue siendo un único hito cumplido.
    await createRequest(lead.id, { subject: "Segunda consulta" })
    const withTwoRequests = await recalculateLeadScore(lead.id)

    expect(withTwoRequests).toBe(withOneRequest)
  })

  itDb("tres fichas distintas suman una sola vez, y dos no suman", async () => {
    const twoViews = await createLead()
    const threeViews = await createLead()

    const entries = await Promise.all(
      [1, 2, 3].map(() =>
        prisma.contentEntry.create({ data: { type: "REAL_WEDDING", slug: uniqueSlug("score"), status: "PUBLISHED" } })
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

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

describe("métricas", () => {
  itDb("la conversión no inventa un porcentaje sin cerradas", () => {
    const empty = conversionOverClosed({
      NEW: 3,
      CONTACTED: 1,
      QUALIFIED: 0,
      VISIT_SCHEDULED: 0,
      PROPOSAL_SENT: 0,
      NEGOTIATION: 0,
      WON: 0,
      LOST: 0,
      NURTURING: 0,
    })
    // Con 0 cerradas no hay 0 %: no hay dato.
    expect(empty.percentage).toBeNull()
    expect(empty.denominator).toBe(0)

    const withData = conversionOverClosed({
      NEW: 10,
      CONTACTED: 0,
      QUALIFIED: 0,
      VISIT_SCHEDULED: 0,
      PROPOSAL_SENT: 0,
      NEGOTIATION: 0,
      WON: 3,
      LOST: 1,
      NURTURING: 0,
    })
    // Sobre cerradas (4), no sobre el total (14).
    expect(withData.percentage).toBe(75)
    expect(withData.denominator).toBe(4)
  })

  itDb("cuenta solicitudes por estado sin incluir archivadas", async () => {
    const lead = await createLead()
    const actor = await createUser("ADMIN")

    // Las filas de este test se colocan en una ventana histórica propia y se
    // cuenta solo ese rango. Comparar el total de la tabla antes y después sería
    // intermitente: Vitest ejecuta los archivos en paralelo y otro test puede
    // crear o borrar una solicitud NEW entre las dos lecturas.
    const day = 1 + (randomBytes(1)[0] % 27)
    const stamp = new Date(Date.UTC(2001, 0, day, 12, 0, 0))
    const range = { from: new Date(stamp.getTime() - 60_000), to: new Date(stamp.getTime() + 60_000) }

    const first = await createRequest(lead.id, { createdAt: stamp })
    await createRequest(lead.id, { createdAt: stamp })

    expect((await countRequestsByStatus(range)).NEW).toBe(2)

    await archiveRequest(first.id, actor.id)
    expect((await countRequestsByStatus(range)).NEW).toBe(1)
  })

  itDb("el tiempo al primer contacto se lee del historial real", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)
    await changeLeadRequestStatus({ leadRequestId: request.id, nextStatus: "CONTACTED" })

    const average = await averageHoursToFirstContact({ from: new Date(Date.now() - 60 * 60 * 1000) })
    expect(average.sampleSize).toBeGreaterThan(0)
    expect(average.value).not.toBeNull()
  })

  itDb("sin muestras el tiempo medio es null y no cero", async () => {
    // Un rango en el futuro no puede contener ninguna solicitud.
    const average = await averageHoursToFirstContact({ from: new Date("2099-01-01"), to: new Date("2099-12-31") })
    expect(average.value).toBeNull()
    expect(average.sampleSize).toBe(0)
  })

  itDb("el embudo no cuenta a quien no pasó por el paso anterior", async () => {
    // Contacto que envía solicitud sin haber pasado por el gate: no puede inflar
    // el último escalón del embudo.
    const lead = await createLead()
    await createRequest(lead.id)

    const before = await acquisitionFunnel()
    expect(before.submittedRequest).toBeLessThanOrEqual(before.viewedContent)
    expect(before.viewedContent).toBeLessThanOrEqual(before.gateGranted)
  })

  itDb("el ratio de identificado a solicitud lleva su denominador", async () => {
    await createLead()
    const ratio = await identifiedToRequestRatio()
    expect(ratio.denominator).toBeGreaterThan(0)
    expect(ratio.numerator).toBeLessThanOrEqual(ratio.denominator)
  })
})

// ---------------------------------------------------------------------------
// Coincidencias
// ---------------------------------------------------------------------------

describe("findPossibleDuplicates", () => {
  itDb("avisa de otro contacto con el mismo teléfono", async () => {
    const phone = `+3460${randomBytes(3).toString("hex").slice(0, 7)}`
    const first = await createLead({ phone, phoneNormalized: phone })
    const second = await createLead({ phone, phoneNormalized: phone, firstName: "Otro", lastName: "Nombre" })

    const duplicates = await findPossibleDuplicates(first.id)
    expect(duplicates.map((row) => row.id)).toContain(second.id)
  })

  itDb("no se propone a sí mismo", async () => {
    const lead = await createLead({ phone: "+34611111111", phoneNormalized: "+34611111111" })
    const duplicates = await findPossibleDuplicates(lead.id)
    expect(duplicates.map((row) => row.id)).not.toContain(lead.id)
  })

  itDb("sin teléfono ni nombre completo no propone nada", async () => {
    const lead = await createLead({ firstName: null, lastName: null })
    expect(await findPossibleDuplicates(lead.id)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

describe("exportación CSV", () => {
  itDb("respeta los filtros y registra un evento de auditoría", async () => {
    const included = await createLead({ score: 90 })
    const excluded = await createLead({ score: 1 })
    const actor = await createUser("ADMIN")

    const csv = await exportLeadsCsv({ minScore: 50 }, { actorId: actor.id })

    expect(csv).toContain(included.email)
    expect(csv).not.toContain(excluded.email)

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: "crm.export.leads", actorId: actor.id },
      orderBy: { createdAt: "desc" },
    })
    expect((audit.metadata as { filas?: number }).filas).toBeGreaterThan(0)
  })

  itDb("no exporta notas internas salvo que se pidan", async () => {
    const lead = await createLead({ score: 95 })
    const actor = await createUser("ADMIN")
    await addLeadNote({ leadId: lead.id, body: "Nota reservada del equipo" })

    const withoutNotes = await exportLeadsCsv({ minScore: 90 }, { actorId: actor.id })
    expect(withoutNotes).not.toContain("Nota reservada del equipo")
    expect(withoutNotes).not.toContain("Notas internas")

    const withNotes = await exportLeadsCsv({ minScore: 90 }, { actorId: actor.id, includeNotes: true })
    expect(withNotes).toContain("Nota reservada del equipo")

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: "crm.export.leads", actorId: actor.id },
      orderBy: { createdAt: "desc" },
    })
    expect((audit.metadata as { incluyeNotas?: boolean }).incluyeNotas).toBe(true)
  })

  itDb("el término de búsqueda no se guarda en la auditoría", async () => {
    const lead = await createLead()
    const actor = await createUser("ADMIN")

    await exportLeadsCsv({ search: lead.email }, { actorId: actor.id })

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: "crm.export.leads", actorId: actor.id },
      orderBy: { createdAt: "desc" },
    })
    // El email buscado es un dato personal: no se copia en la traza.
    expect(JSON.stringify(audit.metadata)).not.toContain(lead.email)
    expect(JSON.stringify(audit.metadata)).toContain("término omitido")
  })

  itDb("neutraliza una fórmula que llegó desde el formulario público", async () => {
    const lead = await createLead({ score: 97 })
    const actor = await createUser("ADMIN")
    await createRequest(lead.id, { subject: "=HYPERLINK(\"http://malo\",\"pulsa\")", guestCount: 10 })

    const csv = await exportRequestsCsv({ minGuests: 10, maxGuests: 10 }, { actorId: actor.id })

    expect(csv).toContain("'=HYPERLINK")
    // La celda no puede empezar por `=` en ningún caso.
    for (const line of csv.split("\r\n")) {
      for (const cell of line.split(";")) {
        expect(cell.startsWith("=")).toBe(false)
      }
    }
  })

  itDb("no exporta columnas internas ni identificadores técnicos", async () => {
    const lead = await createLead({ score: 96 })
    const actor = await createUser("ADMIN")
    await createRequest(lead.id, { submissionId: `secreto-${randomBytes(6).toString("hex")}`, guestCount: 11 })

    const csv = await exportRequestsCsv({ minGuests: 11, maxGuests: 11 }, { actorId: actor.id })

    // `submissionId` es una clave de idempotencia interna: no tiene por qué salir.
    expect(csv).not.toContain("submissionId")
    expect(csv).not.toContain("secreto-")
    expect(csv).not.toContain("leadId")
  })
})

describe("listLeadsForAdmin — la paginación no puede repetir ni perder filas", () => {
  itDb("con la misma actividad y la misma fecha, cada contacto sale una sola vez", async () => {
    // Regresión. El orden era [lastActivityAt desc, createdAt desc], sin criterio
    // único. Dos contactos empatados en ambos campos —lo normal en una ráfaga de
    // altas, en el sembrado de demostración o en dos accesos al gate a la vez—
    // podían cambiar de página entre consultas: uno se veía dos veces y otro no se
    // veía nunca. Si la lista se estaba revisando para atender una supresión, el
    // contacto omitido no se trataba.
    const stamp = new Date("2026-07-01T10:00:00.000Z")
    const marker = `orden-${randomBytes(6).toString("hex")}`
    const ids: string[] = []

    for (let index = 0; index < 6; index += 1) {
      const lead = await prisma.lead.create({
        data: {
          email: uniqueTestEmail(marker),
          emailNormalized: uniqueTestEmail(marker).toLowerCase(),
          firstName: `Contacto ${index}`,
          // Idénticos a propósito: es el empate que rompía la paginación.
          createdAt: stamp,
          lastActivityAt: stamp,
        },
      })
      ids.push(lead.id)
    }

    try {
      const pageSize = 2
      const seen: string[] = []

      for (const page of [1, 2, 3]) {
        const { leads } = await listLeadsForAdmin({ search: marker, page, pageSize })
        seen.push(...leads.map((lead) => lead.id))
      }

      const mine = seen.filter((id) => ids.includes(id))
      expect(mine).toHaveLength(6)
      expect(new Set(mine).size).toBe(6)
      // Y los seis son exactamente los creados: ninguno se ha perdido.
      expect([...mine].sort()).toEqual([...ids].sort())
    } finally {
      await prisma.lead.deleteMany({ where: { id: { in: ids } } })
    }
  })
})

describe("exportRequestsCsv — resistente a un contacto que desaparece", () => {
  itDb("una solicitud huérfana se omite en vez de tumbar la descarga entera", async () => {
    // Regresión de un fallo INTERMITENTE que apareció en la suite completa:
    //
    //   PrismaClientUnknownRequestError: Inconsistent query result:
    //   Field lead is required to return data, got `null` instead.
    //
    // `LeadRequest.lead` es una relación obligatoria, y Prisma resuelve una
    // relación anidada con una segunda consulta. Si entre las dos el contacto ha
    // desaparecido —otro archivo de pruebas borrando en paralelo, o en producción
    // alguien ejecutando `demo:clean` mientras un ADMIN exporta— la exportación
    // completa devolvía 500. Ahora el contacto se lee aparte y la fila huérfana
    // se omite.
    //
    // El escenario se construye a mano porque no se puede provocar la carrera de
    // forma fiable: se crea la solicitud, se borra el contacto con SQL directo
    // saltándose la cascada, y se exporta.
    const marker = `huerfana-${randomBytes(6).toString("hex")}`
    const email = uniqueTestEmail(marker)

    const lead = await prisma.lead.create({
      data: { email, emailNormalized: email.toLowerCase(), firstName: "Sombra" },
    })
    const request = await prisma.leadRequest.create({
      data: { leadId: lead.id, eventType: "WEDDING", subject: marker, message: "mensaje" },
    })

    try {
      // Se rompe la integridad a propósito: DELETE directo sobre la fila del
      // contacto, sin pasar por la cascada de Prisma.
      await prisma.$executeRawUnsafe(`DELETE FROM "public"."lead" WHERE "id" = $1`, lead.id)

      // Antes de la corrección esto lanzaba y la descarga entera fallaba.
      const actor = await createUser("ADMIN")
      const csv = await exportRequestsCsv({ search: marker }, { actorId: actor.id })

      expect(typeof csv).toBe("string")
      // La fila huérfana no aparece —no se sabe de quién era— pero el CSV existe.
      expect(csv).not.toContain(marker)
    } finally {
      await prisma.leadRequest.deleteMany({ where: { id: request.id } })
      await prisma.lead.deleteMany({ where: { id: lead.id } })
      await prisma.auditEvent.deleteMany({ where: { entityType: "LeadRequest", entityId: "export" } })
    }
  })
})
