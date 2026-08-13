"use server"

import { revalidatePath } from "next/cache"
import type { z } from "zod"
import { ForbiddenError, UnauthenticatedError, requirePermission } from "@/lib/auth/session"
import { archiveRequest, updateRequestDetails } from "@/lib/domain/crm-requests"
import { DomainError, InvalidTransitionError } from "@/lib/domain/errors"
import { changeLeadRequestStatus } from "@/lib/domain/lead-requests"
import { addLeadNote, updateLeadNote } from "@/lib/domain/notes"
import { recalculateLeadScore, updateScoringRule } from "@/lib/domain/scoring"
import {
  cancelFollowUpTask,
  completeFollowUpTask,
  createFollowUpTask,
  updateFollowUpTask,
} from "@/lib/domain/tasks"
import {
  changeStatusSchema,
  createTaskSchema,
  leadNoteSchema,
  requestIdSchema,
  scoringRuleSchema,
  taskIdSchema,
  updateLeadNoteSchema,
  updateRequestSchema,
  updateTaskSchema,
} from "@/lib/validation/crm"

/**
 * Mutaciones del CRM.
 *
 * Cada acción **vuelve a autorizar en servidor**. Que el enlace no se vea en la
 * navegación no protege nada: una Server Action es un endpoint, y alguien con
 * sesión de CONTENT podría invocarla directamente. De ahí que la primera línea de
 * cada función sea `requirePermission`, y que la de scoring exija ADMIN aunque el
 * apartado ya esté oculto para el resto.
 */

export type CrmActionResult = { ok: true } | { ok: false; errors: string[] }

function toErrors(error: unknown): string[] {
  if (error instanceof UnauthenticatedError) return ["Tu sesión ha caducado. Vuelve a iniciar sesión."]
  if (error instanceof ForbiddenError) return ["No tienes permisos para esta operación."]
  if (error instanceof InvalidTransitionError) return [error.message]
  if (error instanceof DomainError) return [error.message]
  throw error
}

function fieldErrors(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.message))]
}

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------

export async function addLeadNoteAction(input: unknown): Promise<CrmActionResult> {
  const parsed = leadNoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    await addLeadNote({ leadId: parsed.data.leadId, body: parsed.data.body, authorId: user.id })
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath(`/admin/contactos/${parsed.data.leadId}`)
  return { ok: true }
}

export async function updateLeadNoteAction(input: unknown): Promise<CrmActionResult> {
  const parsed = updateLeadNoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    const note = await updateLeadNote({ id: parsed.data.noteId, body: parsed.data.body, actorId: user.id })
    revalidatePath(`/admin/contactos/${note.leadId}`)
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

export async function createTaskAction(input: unknown): Promise<CrmActionResult> {
  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    await createFollowUpTask({
      leadId: parsed.data.leadId,
      leadRequestId: parsed.data.leadRequestId,
      title: parsed.data.title,
      dueAt: parsed.data.dueAt,
      assigneeId: parsed.data.assigneeId,
      priority: parsed.data.priority,
      actorId: user.id,
    })
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath("/admin/tareas")
  revalidatePath(`/admin/contactos/${parsed.data.leadId}`)
  return { ok: true }
}

export async function updateTaskAction(input: unknown): Promise<CrmActionResult> {
  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    const task = await updateFollowUpTask({
      id: parsed.data.taskId,
      title: parsed.data.title,
      dueAt: parsed.data.dueAt,
      assigneeId: parsed.data.assigneeId ?? null,
      priority: parsed.data.priority,
      actorId: user.id,
    })
    revalidatePath(`/admin/contactos/${task.leadId}`)
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath("/admin/tareas")
  return { ok: true }
}

export async function completeTaskAction(input: unknown): Promise<CrmActionResult> {
  const parsed = taskIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    const task = await completeFollowUpTask(parsed.data.taskId, user.id)
    revalidatePath(`/admin/contactos/${task.leadId}`)
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath("/admin/tareas")
  revalidatePath("/admin")
  return { ok: true }
}

export async function cancelTaskAction(input: unknown): Promise<CrmActionResult> {
  const parsed = taskIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    const task = await cancelFollowUpTask(parsed.data.taskId, user.id)
    revalidatePath(`/admin/contactos/${task.leadId}`)
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath("/admin/tareas")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Solicitudes y pipeline
// ---------------------------------------------------------------------------

export async function changeRequestStatusAction(input: unknown): Promise<CrmActionResult> {
  const parsed = changeStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    // La transición la valida el dominio (`ALLOWED_TRANSITIONS`), no la interfaz:
    // que un botón no se pinte no impide que alguien envíe el formulario.
    await changeLeadRequestStatus({
      leadRequestId: parsed.data.requestId,
      nextStatus: parsed.data.nextStatus,
      lostReason: parsed.data.lostReason,
      actorId: user.id,
    })
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath("/admin/pipeline")
  revalidatePath("/admin/solicitudes")
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`)
  revalidatePath("/admin")
  return { ok: true }
}

export async function updateRequestAction(input: unknown): Promise<CrmActionResult> {
  const parsed = updateRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    await updateRequestDetails({
      id: parsed.data.requestId,
      actorId: user.id,
      priority: parsed.data.priority,
      ownerId: parsed.data.ownerId ?? null,
      nextActionAt: parsed.data.nextActionAt,
      preferredSpace: parsed.data.preferredSpace,
      budgetRange: parsed.data.budgetRange,
    })
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath("/admin/solicitudes")
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`)
  revalidatePath("/admin/pipeline")
  return { ok: true }
}

export async function archiveRequestAction(input: unknown): Promise<CrmActionResult> {
  const parsed = requestIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("crm:access")
    await archiveRequest(parsed.data.requestId, user.id)
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath("/admin/solicitudes")
  revalidatePath("/admin/pipeline")
  return { ok: true }
}

export async function recalculateLeadScoreAction(input: unknown): Promise<CrmActionResult> {
  const parsed = leadNoteSchema.pick({ leadId: true }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    await requirePermission("crm:access")
    // Es idempotente por construcción: recalcula desde el historial con los pesos
    // vigentes, así que pulsarlo dos veces da el mismo número.
    await recalculateLeadScore(parsed.data.leadId)
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath(`/admin/contactos/${parsed.data.leadId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Configuración (ADMIN)
// ---------------------------------------------------------------------------

export async function updateScoringRuleAction(input: unknown): Promise<CrmActionResult> {
  const parsed = scoringRuleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  try {
    const user = await requirePermission("settings:manage")
    await updateScoringRule({
      key: parsed.data.key,
      points: parsed.data.points,
      active: parsed.data.active,
      actorId: user.id,
    })
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }

  revalidatePath("/admin/configuracion")
  return { ok: true }
}
