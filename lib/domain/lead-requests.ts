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

  await recalculateLeadScore(created.lead.id)

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
 * Máquina de estados del pipeline. WON es terminal. Desde LOST solo se
 * permite reabrir a NURTURING. No están listadas => transición no permitida.
 */
const ALLOWED_TRANSITIONS: Record<LeadRequestStatus, LeadRequestStatus[]> = {
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["QUALIFIED", "NURTURING", "LOST"],
  QUALIFIED: ["VISIT_SCHEDULED", "NURTURING", "LOST"],
  VISIT_SCHEDULED: ["PROPOSAL_SENT", "NURTURING", "LOST"],
  PROPOSAL_SENT: ["NEGOTIATION", "LOST"],
  NEGOTIATION: ["WON", "LOST"],
  NURTURING: ["CONTACTED", "QUALIFIED", "LOST"],
  WON: [],
  LOST: ["NURTURING"],
}

export type ChangeLeadRequestStatusInput = {
  leadRequestId: string
  nextStatus: LeadRequestStatus
  actorId?: string
  lostReason?: string
}

/** Cambia el estado de pipeline de una LeadRequest validando la transición. */
export async function changeLeadRequestStatus(input: ChangeLeadRequestStatusInput): Promise<LeadRequest> {
  const current = await prisma.leadRequest.findUniqueOrThrow({ where: { id: input.leadRequestId } })

  if (current.status === input.nextStatus) return current

  const allowed = ALLOWED_TRANSITIONS[current.status]
  if (!allowed.includes(input.nextStatus)) {
    throw new InvalidTransitionError(current.status, input.nextStatus)
  }
  if (input.nextStatus === "LOST" && !input.lostReason) {
    throw new DomainError("lostReason es obligatorio al marcar una LeadRequest como LOST")
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leadRequest.update({
      where: { id: input.leadRequestId },
      data: {
        status: input.nextStatus,
        lostReason: input.nextStatus === "LOST" ? input.lostReason : current.lostReason,
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

    return updated
  })
}
