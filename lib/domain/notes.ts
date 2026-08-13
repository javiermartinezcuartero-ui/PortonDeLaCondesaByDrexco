import { prisma } from "@/lib/db"
import { recordAuditEvent } from "@/lib/domain/audit"
import { DomainError } from "@/lib/domain/errors"
import { stripControlCharacters } from "@/lib/security/text"
import type { LeadNote } from "@prisma/client"

/**
 * Notas internas de un contacto.
 *
 * Son **internas**: nunca se muestran al visitante ni salen en la exportación
 * salvo decisión expresa (ver lib/domain/crm-export.ts). Se guardan como texto
 * plano y se renderizan interpolándolas en JSX, que escapa por sí solo: **no se
 * usa `dangerouslySetInnerHTML` en ninguna parte del CRM**, así que una nota con
 * `<script>` se lee como texto, que es lo que es.
 *
 * Editar una nota se audita. Una nota es la versión que alguien del equipo dio de
 * una conversación; si se puede cambiar sin rastro, deja de ser fiable.
 */

export const NOTE_MAX_LENGTH = 4_000
export const NOTE_MIN_LENGTH = 1

export async function addLeadNote(input: { leadId: string; body: string; authorId?: string }): Promise<LeadNote> {
  const body = normalizeNoteBody(input.body)

  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true } })
  if (!lead) throw new DomainError("El contacto no existe")

  const note = await prisma.leadNote.create({
    data: { leadId: input.leadId, body, authorId: input.authorId },
  })

  await recordAuditEvent({
    entityType: "LeadNote",
    entityId: note.id,
    action: "note.create",
    actorId: input.authorId,
    // Solo la longitud: el cuerpo de la nota no se duplica en la auditoría.
    metadata: { leadId: input.leadId, longitud: body.length },
  })

  return note
}

export async function updateLeadNote(input: { id: string; body: string; actorId?: string }): Promise<LeadNote> {
  const body = normalizeNoteBody(input.body)

  const current = await prisma.leadNote.findUnique({
    where: { id: input.id },
    select: { id: true, leadId: true, body: true },
  })
  if (!current) throw new DomainError("La nota no existe")

  const updated = await prisma.leadNote.update({ where: { id: input.id }, data: { body } })

  await recordAuditEvent({
    entityType: "LeadNote",
    entityId: input.id,
    action: "note.update",
    actorId: input.actorId,
    metadata: { leadId: current.leadId, longitudAnterior: current.body.length, longitudNueva: body.length },
  })

  return updated
}

/**
 * Recorta y valida el cuerpo de una nota. Se eliminan caracteres de control
 * (PostgreSQL rechaza el byte NUL) pero **no se transforma el texto**: si alguien
 * escribe comillas o etiquetas, se guardan tal cual.
 */
function normalizeNoteBody(raw: string): string {
  const body = stripControlCharacters(raw).trim()
  if (body.length < NOTE_MIN_LENGTH) throw new DomainError("La nota no puede estar vacía")
  if (body.length > NOTE_MAX_LENGTH) {
    throw new DomainError(`La nota no puede superar ${NOTE_MAX_LENGTH} caracteres`)
  }
  return body
}
