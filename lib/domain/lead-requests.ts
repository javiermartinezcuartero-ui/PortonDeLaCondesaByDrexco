import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getOrCreateLead } from "@/lib/domain/leads"
import { recordActivity } from "@/lib/domain/activities"
import { recordConsent } from "@/lib/domain/consents"
import { recalculateLeadScore } from "@/lib/domain/scoring"
import { InvalidTransitionError, DomainError } from "@/lib/domain/errors"
import type { Lead, LeadRequest, LeadRequestStatus, Priority } from "@prisma/client"

/**
 * Consentimientos que acompañan a una solicitud enviada por una persona desde
 * un formulario público. Privacidad y marketing son decisiones separadas.
 */
export type LeadRequestConsents = {
  /** Obligatorio y siempre `true`: sin base legal no hay solicitud que guardar. */
  privacyConsent: true
  marketingConsent: boolean
  policyVersion: string
}

export type CreateLeadRequestInput = {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  eventType: string
  eventDate?: Date
  guestCount?: number
  company?: string
  jobTitle?: string
  audiovisualNeeds?: string
  preferredSpace?: string
  budgetRange?: string
  subject?: string
  message?: string
  sourcePage?: string
  sourceForm?: string
  sourceContentId?: string
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  priority?: Priority
  /**
   * Clave de idempotencia del envío. Con ella, dos peticiones idénticas (un
   * doble clic, un reintento de red) producen una sola LeadRequest.
   */
  submissionId?: string
  /** Si viene, los eventos de consentimiento se anotan en la misma transacción. */
  consents?: LeadRequestConsents
}

export type CreateLeadRequestResult = {
  lead: Lead
  leadRequest: LeadRequest
  /** `true` si esta llamada no creó nada porque `submissionId` ya existía. */
  duplicate: boolean
}

/**
 * Crea una LeadRequest nueva, siempre. Nunca actualiza/sobrescribe una
 * petición anterior del mismo email: si el Lead ya existe, esta petición se
 * añade como una fila más de su historial.
 *
 * Todo ocurre en una única transacción —Lead, LeadRequest, consentimientos y
 * actividad— para que no pueda quedar una solicitud sin su base legal ni un
 * consentimiento sin la solicitud que lo motivó.
 *
 * La única excepción es `recalculateLeadScore`, que va después del commit: el
 * score es un dato derivado y recalcularlo dentro alargaría la transacción sin
 * ninguna ganancia de integridad.
 */
export async function createLeadRequest(input: CreateLeadRequestInput): Promise<CreateLeadRequestResult> {
  const source = input.utmSource ?? input.sourcePage

  // Camino rápido de idempotencia: si esta clave de envío ya está guardada, la
  // solicitud existe y no hay nada que hacer.
  if (input.submissionId) {
    const existing = await findBySubmissionId(input.submissionId)
    if (existing) return existing
  }

  let created: { lead: Lead; leadRequest: LeadRequest }
  try {
    created = await prisma.$transaction(async (tx) => {
      const lead = await getOrCreateLead(
        { email: input.email, firstName: input.firstName, lastName: input.lastName, phone: input.phone, source },
        tx
      )

      const leadRequest = await tx.leadRequest.create({
        data: {
          leadId: lead.id,
          submissionId: input.submissionId,
          eventType: input.eventType,
          eventDate: input.eventDate,
          guestCount: input.guestCount,
          company: input.company,
          jobTitle: input.jobTitle,
          audiovisualNeeds: input.audiovisualNeeds,
          preferredSpace: input.preferredSpace,
          budgetRange: input.budgetRange,
          subject: input.subject,
          message: input.message,
          priority: input.priority,
          sourcePage: input.sourcePage,
          sourceForm: input.sourceForm,
          sourceContentId: input.sourceContentId,
          referrer: input.referrer,
          utmSource: input.utmSource,
          utmMedium: input.utmMedium,
          utmCampaign: input.utmCampaign,
          utmContent: input.utmContent,
          utmTerm: input.utmTerm,
        },
      })

      if (input.consents) {
        const consentSource = input.sourceForm ?? input.sourcePage

        await recordConsent(
          {
            leadId: lead.id,
            purpose: "PRIVACY",
            granted: true,
            policyVersion: input.consents.policyVersion,
            source: consentSource,
          },
          tx
        )

        // El evento de MARKETING solo se anota cuando la persona lo concede.
        // Registrar un granted=false por cada casilla que se deja sin marcar
        // revocaría de hecho un consentimiento dado antes por otra vía (p. ej.
        // en el acceso VIP), y dejar una casilla vacía en un formulario de
        // contacto no es una petición de baja. Las bajas se modelan como un
        // evento explícito granted=false desde el CRM.
        if (input.consents.marketingConsent) {
          await recordConsent(
            {
              leadId: lead.id,
              purpose: "MARKETING",
              granted: true,
              policyVersion: input.consents.policyVersion,
              source: consentSource,
            },
            tx
          )
        }
      }

      await recordActivity(
        {
          leadId: lead.id,
          leadRequestId: leadRequest.id,
          type: "FORM_SUBMITTED",
          metadata: { eventType: input.eventType, sourcePage: input.sourcePage, sourceForm: input.sourceForm },
        },
        tx
      )

      return { lead, leadRequest }
    })
  } catch (error) {
    // Dos peticiones simultáneas con la misma clave de envío: una gana el
    // índice único y la otra llega aquí. No es un error para quien envía el
    // formulario, su solicitud está guardada.
    if (input.submissionId && isUniqueSubmissionIdViolation(error)) {
      const existing = await findBySubmissionId(input.submissionId)
      if (existing) return existing
    }
    throw error
  }

  // Fuera de la transacción y **sin propagar el fallo**, igual que en
  // `grantVipAccess`. La solicitud ya está confirmada: si el recálculo del score
  // falla —agotamiento del pool, timeout del pooler—, propagar la excepción haría
  // que el endpoint devolviese 503 `persistence-failed` sobre datos que SÍ están
  // guardados, y que `runAfterResponse(notifyNewLeadRequest)` no llegara a
  // ejecutarse nunca: la finca no recibiría el aviso de esa solicitud, y el
  // reintento del visitante entraría por la rama `duplicate`, que tampoco avisa.
  // El score no se pierde: se recalcula en el siguiente movimiento del contacto.
  await recalculateLeadScore(created.lead.id).catch(() => undefined)

  return { ...created, duplicate: false }
}

async function findBySubmissionId(submissionId: string): Promise<CreateLeadRequestResult | null> {
  const existing = await prisma.leadRequest.findUnique({
    where: { submissionId },
    include: { lead: true },
  })
  if (!existing) return null

  const { lead, ...leadRequest } = existing
  return { lead, leadRequest, duplicate: true }
}

function isUniqueSubmissionIdViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    // `target` llega como lista de campos afectados; en algunos motores como
    // texto. Se acepta cualquiera de las dos formas.
    JSON.stringify(error.meta?.target ?? "").includes("submissionId")
  )
}

/**
 * Máquina de estados del pipeline, sobre las cinco fases del enum.
 *
 * CLIENT sigue siendo terminal: un evento cerrado no vuelve al embudo. LOST se puede
 * reabrir, y ahora reabre a CONTACT —antes reabría a NURTURING, que ya no existe—.
 *
 * **Se permite un paso hacia atrás** (PRESENTATION → CONTACT, PROPOSAL →
 * PRESENTATION), y es un cambio respecto a la versión de nueve estados, que solo
 * avanzaba. El motivo: con nueve estados había un aparcamiento (NURTURING) al que
 * retirar una solicitud que se enfriaba, así que existía una vía de vuelta. Al reducir
 * a cinco fases ese aparcamiento desaparece, y sin transición hacia atrás la única
 * forma de deshacer un avance —un arrastre a la columna equivocada, por ejemplo— sería
 * darla por perdida y reabrirla, que ensucia el historial con dos movimientos falsos.
 *
 * Lo que no está listado no se permite: sigue sin poderse saltar una fase.
 */
const ALLOWED_TRANSITIONS: Record<LeadRequestStatus, LeadRequestStatus[]> = {
  CONTACT: ["PRESENTATION", "LOST"],
  PRESENTATION: ["PROPOSAL", "CONTACT", "LOST"],
  PROPOSAL: ["CLIENT", "PRESENTATION", "LOST"],
  CLIENT: [],
  LOST: ["CONTACT"],
}

export type ChangeLeadRequestStatusInput = {
  leadRequestId: string
  nextStatus: LeadRequestStatus
  actorId?: string
  lostReason?: string
}

/** Transiciones permitidas desde un estado dado. Para pintar solo lo posible. */
export function allowedTransitionsFrom(status: LeadRequestStatus): readonly LeadRequestStatus[] {
  return ALLOWED_TRANSITIONS[status]
}

/**
 * Cambia el estado de pipeline de una LeadRequest validando la transición.
 *
 * La actividad del contacto y el evento de auditoría se escriben **dentro de la
 * misma transacción** que el cambio de estado: no puede quedar una solicitud
 * movida sin rastro de quién la movió, ni un rastro de un movimiento que no
 * ocurrió.
 */
export async function changeLeadRequestStatus(input: ChangeLeadRequestStatusInput): Promise<LeadRequest> {
  const current = await prisma.leadRequest.findUniqueOrThrow({ where: { id: input.leadRequestId } })

  if (current.status === input.nextStatus) return current

  const allowed = ALLOWED_TRANSITIONS[current.status]
  if (!allowed.includes(input.nextStatus)) {
    throw new InvalidTransitionError(current.status, input.nextStatus)
  }
  if (input.nextStatus === "LOST" && !input.lostReason?.trim()) {
    throw new DomainError("Indica el motivo de la pérdida para poder marcarla como perdida")
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leadRequest.update({
      where: { id: input.leadRequestId },
      data: {
        status: input.nextStatus,
        lostReason: input.nextStatus === "LOST" ? input.lostReason?.trim() : current.lostReason,
      },
    })

    await recordActivity(
      {
        leadId: current.leadId,
        leadRequestId: current.id,
        actorId: input.actorId,
        type: "STATUS_CHANGED",
        metadata: { from: current.status, to: input.nextStatus },
      },
      tx
    )

    await tx.auditEvent.create({
      data: {
        entityType: "LeadRequest",
        entityId: current.id,
        action: "request.status",
        actorId: input.actorId,
        // Sin PII: estados y, si acaso, la longitud del motivo. El motivo en sí
        // vive en la propia solicitud, no duplicado en la auditoría.
        metadata: {
          from: current.status,
          to: input.nextStatus,
          ...(input.nextStatus === "LOST" ? { motivoLongitud: input.lostReason?.trim().length ?? 0 } : {}),
        },
      },
    })

    return updated
  })
}
