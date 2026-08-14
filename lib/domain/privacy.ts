import { prisma } from "@/lib/db"
import { recordAuditEvent } from "@/lib/domain/audit"
import { DomainError } from "@/lib/domain/errors"
import type { Lead, Prisma } from "@prisma/client"

/**
 * Operaciones de privacidad sobre un contacto: exportación de sus datos,
 * anonimización, revocación de marketing y revocación de accesos VIP.
 *
 * Todas exigen ADMIN en la capa de acción (`app/admin/(protected)/privacy-actions.ts`).
 * Aquí está la lógica; la autorización se comprueba allí y se vuelve a comprobar en
 * cada llamada, nunca se asume por venir de una pantalla concreta.
 */

// ---------------------------------------------------------------------------
// Retención
// ---------------------------------------------------------------------------

/**
 * Meses que se conservan los contactos sin actividad antes de poder anonimizarlos.
 *
 * Configurable por entorno porque el plazo es una decisión de negocio y jurídica,
 * no técnica. El valor por defecto (36 meses) es un punto de partida razonable para
 * un negocio de eventos —una boda se planifica con uno o dos años de antelación—,
 * **pero no está validado por un profesional**: ver README §Pendientes legales.
 *
 * Importante: la retención aquí **no borra nada sola**. Solo identifica candidatos;
 * anonimizar sigue siendo una acción explícita de un ADMIN o del script de purga.
 */
export function retentionMonths(): number {
  const raw = process.env.DATA_RETENTION_MONTHS?.trim()
  if (!raw) return 36
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 240) return 36
  return parsed
}

export function retentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - retentionMonths())
  return cutoff
}

/**
 * Contactos que superan el plazo de retención y todavía no están anonimizados.
 *
 * "Sin actividad" se mide por `lastActivityAt`, y si nunca la hubo por
 * `firstSeenAt`: un contacto que dejó su email y nunca volvió también prescribe.
 * Se excluyen los que tienen una solicitud viva en el pipeline: mientras haya una
 * negociación abierta, el dato sigue siendo necesario para la finalidad que lo
 * justificó.
 */
export async function findLeadsBeyondRetention(now: Date = new Date(), limit = 100) {
  const cutoff = retentionCutoff(now)

  return prisma.lead.findMany({
    where: {
      lifecycle: { not: "ANONYMIZED" },
      OR: [{ lastActivityAt: { lt: cutoff } }, { AND: [{ lastActivityAt: null }, { firstSeenAt: { lt: cutoff } }] }],
      requests: {
        none: {
          archivedAt: null,
          status: { notIn: ["CLIENT", "LOST"] },
        },
      },
    },
    orderBy: { firstSeenAt: "asc" },
    take: limit,
    select: { id: true, firstSeenAt: true, lastActivityAt: true, _count: { select: { requests: true } } },
  })
}

// ---------------------------------------------------------------------------
// Exportación de los datos de una persona (derecho de acceso)
// ---------------------------------------------------------------------------

/**
 * Todo lo que el sistema guarda sobre una persona, en un objeto serializable.
 *
 * Es el derecho de acceso del RGPD, y por eso incluye **más** que la exportación
 * comercial: aquí sí van sus notas internas y su historial completo, porque son
 * datos sobre ella. Lo que no va, por no ser suyo: hashes de token, claves y los
 * identificadores internos de otras entidades.
 */
export async function exportLeadPersonalData(leadId: string, actorId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      tags: { include: { tag: { select: { name: true } } } },
      consents: { orderBy: { createdAt: "asc" } },
      requests: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      activities: { orderBy: { createdAt: "asc" } },
      followUps: { orderBy: { createdAt: "asc" }, include: { assignee: { select: { name: true } } } },
      interactions: {
        orderBy: { createdAt: "asc" },
        include: { contentEntry: { select: { slug: true, type: true } } },
      },
      // Las sesiones VIP van **sin el hash del token**: es un secreto del sistema,
      // no un dato de la persona.
      vipSessions: {
        orderBy: { createdAt: "asc" },
        select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, lastUsedAt: true },
      },
      notifications: {
        orderBy: { createdAt: "asc" },
        select: { id: true, template: true, status: true, provider: true, createdAt: true, sentAt: true },
      },
    },
  })

  if (!lead) throw new DomainError("El contacto no existe")

  await recordAuditEvent({
    entityType: "Lead",
    entityId: leadId,
    action: "privacy.export",
    actorId,
    metadata: { solicitudes: lead.requests.length, notas: lead.notes.length },
  })

  return {
    generadoEl: new Date().toISOString(),
    aviso:
      "Copia de los datos personales que constan en el sistema sobre este contacto, generada a petición y bajo registro de auditoría.",
    contacto: {
      email: lead.email,
      nombre: lead.firstName,
      apellidos: lead.lastName,
      telefono: lead.phone,
      puntuacion: lead.score,
      cicloDeVida: lead.lifecycle,
      origenInicial: lead.firstSource,
      origenReciente: lead.lastSource,
      primeraVisita: lead.firstSeenAt,
      ultimaActividad: lead.lastActivityAt,
      anonimizadoEl: lead.anonymizedAt,
      etiquetas: lead.tags.map((entry) => entry.tag.name),
    },
    consentimientos: lead.consents.map((consent) => ({
      proposito: consent.purpose,
      concedido: consent.granted,
      versionPolitica: consent.policyVersion,
      origen: consent.source,
      fecha: consent.createdAt,
    })),
    solicitudes: lead.requests,
    notasInternas: lead.notes.map((note) => ({
      texto: note.body,
      autor: note.author?.name ?? null,
      creada: note.createdAt,
      actualizada: note.updatedAt,
    })),
    tareas: lead.followUps.map((task) => ({
      titulo: task.title,
      vence: task.dueAt,
      estado: task.status,
      prioridad: task.priority,
      responsable: task.assignee?.name ?? null,
    })),
    historial: lead.activities.map((activity) => ({
      tipo: activity.type,
      fecha: activity.createdAt,
      detalle: activity.metadata,
    })),
    contenidoConsultado: lead.interactions.map((interaction) => ({
      tipo: interaction.type,
      seccion: interaction.section,
      ficha: interaction.contentEntry?.slug ?? null,
      fecha: interaction.createdAt,
    })),
    sesionesDeAcceso: lead.vipSessions,
    avisosEnviados: lead.notifications,
  }
}

// ---------------------------------------------------------------------------
// Revocaciones
// ---------------------------------------------------------------------------

/**
 * Revoca el consentimiento de marketing con un evento nuevo `granted=false`.
 *
 * No se borra ni se modifica el consentimiento anterior: el historial de
 * consentimientos es un registro inmutable, y poder demostrar que alguien consintió
 * el 3 de marzo y revocó el 12 de junio es justo lo que exige el RGPD.
 */
export async function revokeMarketingConsent(input: {
  leadId: string
  actorId: string
  policyVersion: string
}): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true } })
  if (!lead) throw new DomainError("El contacto no existe")

  await prisma.$transaction(async (tx) => {
    await tx.consentEvent.create({
      data: {
        leadId: input.leadId,
        purpose: "MARKETING",
        granted: false,
        policyVersion: input.policyVersion,
        source: "admin-revocation",
      },
    })

    await tx.auditEvent.create({
      data: {
        entityType: "Lead",
        entityId: input.leadId,
        action: "privacy.marketing.revoke",
        actorId: input.actorId,
      },
    })
  })
}

/** Revoca todas las sesiones de acceso VIP activas de un contacto. */
export async function revokeAllVipSessions(input: { leadId: string; actorId: string }): Promise<number> {
  const now = new Date()

  const revoked = await prisma.vipAccessSession.updateMany({
    where: { leadId: input.leadId, revokedAt: null },
    data: { revokedAt: now },
  })

  if (revoked.count > 0) {
    await recordAuditEvent({
      entityType: "Lead",
      entityId: input.leadId,
      action: "privacy.vip.revoke",
      actorId: input.actorId,
      metadata: { sesiones: revoked.count },
    })
  }

  return revoked.count
}

// ---------------------------------------------------------------------------
// Anonimización
// ---------------------------------------------------------------------------

export type AnonymizationSummary = {
  lead: Lead
  requestsCleared: number
  notesDeleted: number
  vipSessionsRevoked: number
  notificationsCleared: number
}

/**
 * Anonimiza un contacto de forma **transaccional y completa**.
 *
 * La versión anterior solo tocaba las columnas del propio `Lead`, y eso dejaba la
 * persona perfectamente identificable en sitios donde nadie mira: el mensaje libre
 * de sus solicitudes ("soy Ana y mi teléfono es..."), las notas del equipo, y los
 * destinatarios enmascarados de los avisos. Anonimizar a medias es no anonimizar.
 *
 * Qué hace, y por qué cada cosa:
 *
 * - **Sustituye** email, nombre, apellidos y teléfono por valores no reversibles. El
 *   email pasa a `anonimizado+<id>@example.invalid`: `.invalid` es un TLD reservado
 *   (RFC 2606) que nunca podrá existir, así que no hay riesgo de escribir por error
 *   a un buzón real.
 * - **Vacía el texto libre de las solicitudes** (asunto, mensaje, empresa, cargo,
 *   necesidades audiovisuales, motivo de pérdida) y **conserva lo agregable**: tipo
 *   de evento, fecha, invitados, espacio, presupuesto, estado y atribución. Las
 *   métricas del CRM siguen cuadrando; la persona desaparece.
 * - **Borra las notas internas.** No son agregables y son opiniones sobre una
 *   persona identificada. Se cuenta cuántas se borraron en la auditoría.
 * - **Revoca todas las sesiones VIP**, para que una cookie que siga en un navegador
 *   no vuelva a resolver a este contacto.
 * - **Limpia los destinatarios enmascarados** de `NotificationLog`: aunque estén
 *   ocultos a medias, el dominio sigue siendo un dato.
 * - **Conserva la auditoría** (`AuditEvent`) y el historial de consentimientos: son
 *   la prueba de que el tratamiento fue legítimo y de que esta anonimización
 *   ocurrió. `LeadActivity.metadata` ya pasa por el saneador y no contiene PII.
 */
export async function anonymizeLead(leadId: string, actorId?: string): Promise<AnonymizationSummary> {
  const summary = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: leadId } })
    if (!lead) throw new DomainError("El contacto no existe")
    if (lead.lifecycle === "ANONYMIZED") {
      throw new DomainError("Este contacto ya está anonimizado")
    }

    const placeholder = `anonimizado+${lead.id}@example.invalid`

    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        email: placeholder,
        emailNormalized: placeholder,
        firstName: null,
        lastName: null,
        phone: null,
        phoneNormalized: null,
        lifecycle: "ANONYMIZED",
        anonymizedAt: new Date(),
      },
    })

    // Texto libre fuera; lo agregable se queda.
    const cleared: Prisma.LeadRequestUpdateManyMutationInput = {
      subject: null,
      message: null,
      company: null,
      jobTitle: null,
      audiovisualNeeds: null,
      lostReason: null,
    }
    const requests = await tx.leadRequest.updateMany({ where: { leadId }, data: cleared })

    const notes = await tx.leadNote.deleteMany({ where: { leadId } })

    const sessions = await tx.vipAccessSession.updateMany({
      where: { leadId, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    const notifications = await tx.notificationLog.updateMany({
      where: { leadId, recipients: { not: null } },
      data: { recipients: null },
    })

    await tx.auditEvent.create({
      data: {
        entityType: "Lead",
        entityId: leadId,
        action: "privacy.anonymize",
        actorId: actorId ?? null,
        metadata: {
          solicitudesLimpiadas: requests.count,
          notasBorradas: notes.count,
          sesionesRevocadas: sessions.count,
          avisosLimpiados: notifications.count,
        },
      },
    })

    return {
      lead: updated,
      requestsCleared: requests.count,
      notesDeleted: notes.count,
      vipSessionsRevoked: sessions.count,
      notificationsCleared: notifications.count,
    }
  })

  return summary
}
