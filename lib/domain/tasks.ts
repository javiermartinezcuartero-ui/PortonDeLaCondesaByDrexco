import { prisma } from "@/lib/db"
import { recordActivity } from "@/lib/domain/activities"
import { DomainError } from "@/lib/domain/errors"
import type { FollowUpStatus, FollowUpTask, Prisma, Priority } from "@prisma/client"

/**
 * Tareas de seguimiento comercial.
 *
 * Regla de fondo: **cancelar no borra**. Una tarea cancelada conserva su fila,
 * su autor, su fecha y su historial; solo cambia de estado. El CRM tiene que
 * poder responder a "¿qué se decidió no hacer y cuándo?", y eso desaparece si se
 * elimina la fila.
 *
 * Nota sobre el modelo: `FollowUpTask` cuelga de `Lead`. El enlace opcional a una
 * `LeadRequest` concreta se guarda en la actividad que registra la tarea, de modo
 * que en el historial de esa solicitud queda constancia sin necesidad de una
 * columna nueva.
 */

export type CreateFollowUpTaskInput = {
  leadId: string
  title: string
  dueAt: Date
  assigneeId?: string
  priority?: Priority
  /** Solicitud a la que se refiere la tarea, si es una en concreto. */
  leadRequestId?: string
  actorId?: string
}

export async function createFollowUpTask(input: CreateFollowUpTaskInput): Promise<FollowUpTask> {
  await assertLeadExists(input.leadId)
  if (input.assigneeId) await assertUserExists(input.assigneeId)
  if (input.leadRequestId) await assertRequestBelongsToLead(input.leadRequestId, input.leadId)

  return prisma.$transaction(async (tx) => {
    const task = await tx.followUpTask.create({
      data: {
        leadId: input.leadId,
        title: input.title,
        dueAt: input.dueAt,
        assigneeId: input.assigneeId,
        priority: input.priority,
      },
    })

    await recordActivity(
      {
        leadId: input.leadId,
        leadRequestId: input.leadRequestId,
        actorId: input.actorId,
        type: "NOTE",
        metadata: { accion: "tarea-creada", tareaId: task.id, vence: input.dueAt.toISOString() },
      },
      tx
    )

    return task
  })
}

export type UpdateFollowUpTaskInput = {
  id: string
  title: string
  dueAt: Date
  assigneeId: string | null
  priority: Priority
  actorId?: string
}

/** Edita una tarea pendiente. Una tarea ya cerrada no se reescribe. */
export async function updateFollowUpTask(input: UpdateFollowUpTaskInput): Promise<FollowUpTask> {
  const current = await requireTask(input.id)
  if (current.status !== "PENDING") {
    throw new DomainError("Una tarea completada o cancelada no se puede editar")
  }
  if (input.assigneeId) await assertUserExists(input.assigneeId)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.followUpTask.update({
      where: { id: input.id },
      data: {
        title: input.title,
        dueAt: input.dueAt,
        assigneeId: input.assigneeId,
        priority: input.priority,
      },
    })

    if (current.assigneeId !== input.assigneeId) {
      await recordActivity(
        {
          leadId: current.leadId,
          actorId: input.actorId,
          type: "NOTE",
          metadata: { accion: "tarea-reasignada", tareaId: current.id, anterior: current.assigneeId, nuevo: input.assigneeId },
        },
        tx
      )
    }

    return updated
  })
}

/**
 * Marca la tarea como completada y **registra la actividad** en el historial del
 * contacto: completar una tarea es trabajo comercial hecho, y tiene que verse en
 * el timeline, no solo en la lista de tareas.
 */
export async function completeFollowUpTask(id: string, actorId?: string): Promise<FollowUpTask> {
  const current = await requireTask(id)
  if (current.status === "COMPLETED") return current
  if (current.status === "CANCELLED") throw new DomainError("Una tarea cancelada no se puede completar")

  return prisma.$transaction(async (tx) => {
    const updated = await tx.followUpTask.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    })

    await recordActivity(
      {
        leadId: current.leadId,
        actorId,
        type: "NOTE",
        metadata: { accion: "tarea-completada", tareaId: id, titulo: current.title },
      },
      tx
    )

    return updated
  })
}

/** Cancela la tarea conservando la fila y su historial. */
export async function cancelFollowUpTask(id: string, actorId?: string): Promise<FollowUpTask> {
  const current = await requireTask(id)
  if (current.status === "CANCELLED") return current
  if (current.status === "COMPLETED") throw new DomainError("Una tarea completada no se puede cancelar")

  return prisma.$transaction(async (tx) => {
    // `completedAt` se deja como está (null): cancelar no es completar.
    const updated = await tx.followUpTask.update({ where: { id }, data: { status: "CANCELLED" } })

    await recordActivity(
      {
        leadId: current.leadId,
        actorId,
        type: "NOTE",
        metadata: { accion: "tarea-cancelada", tareaId: id, titulo: current.title },
      },
      tx
    )

    return updated
  })
}

// ---------------------------------------------------------------------------
// Vistas
// ---------------------------------------------------------------------------

export const TASK_VIEWS = ["mias", "vencidas", "hoy", "semana", "completadas", "todas"] as const

export type TaskView = (typeof TASK_VIEWS)[number]

export function isTaskView(value: string): boolean {
  return (TASK_VIEWS as readonly string[]).includes(value)
}

export const TASK_LIST_PAGE_SIZE = 30

export function buildTaskWhere(view: TaskView, viewerId: string, now: Date): Prisma.FollowUpTaskWhereInput {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
  const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000)

  switch (view) {
    case "mias":
      return { assigneeId: viewerId, status: "PENDING" }
    case "vencidas":
      return { status: "PENDING", dueAt: { lt: now } }
    case "hoy":
      return { status: "PENDING", dueAt: { gte: startOfDay, lt: endOfDay } }
    case "semana":
      return { status: "PENDING", dueAt: { gte: startOfDay, lt: endOfWeek } }
    case "completadas":
      // Incluye las canceladas a propósito: son el registro de lo cerrado, y
      // esconder las canceladas sería esconder decisiones tomadas.
      return { status: { in: ["COMPLETED", "CANCELLED"] } }
    default:
      return {}
  }
}

/**
 * Orden de cada vista.
 *
 * `todas` es la vista que usa la pantalla de Acciones, y ordena **primero por estado**:
 * el enum `FollowUpStatus` está declarado PENDING, COMPLETED, CANCELLED, y PostgreSQL
 * ordena un enum por su orden de declaración, así que ascendente deja lo pendiente arriba.
 * Sin eso, una tabla con todo mezclado y ordenada por fecha empieza por las tareas
 * cerradas hace meses, que es exactamente lo que nadie va a mirar.
 */
function taskOrderBy(view: TaskView): Prisma.FollowUpTaskOrderByWithRelationInput[] {
  if (view === "completadas") return [{ updatedAt: "desc" }]
  if (view === "todas") return [{ status: "asc" }, { dueAt: "asc" }, { priority: "desc" }]
  return [{ dueAt: "asc" }, { priority: "desc" }]
}

export async function listTasks(view: TaskView, viewerId: string, now: Date, page = 1) {
  const where = buildTaskWhere(view, viewerId, now)
  const pageSize = TASK_LIST_PAGE_SIZE

  const [total, tasks] = await Promise.all([
    prisma.followUpTask.count({ where }),
    prisma.followUpTask.findMany({
      where,
      orderBy: taskOrderBy(view),
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
      include: {
        lead: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
  ])

  return { tasks, total, page: Math.max(1, page), totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export type TaskRow = Awaited<ReturnType<typeof listTasks>>["tasks"][number]

// `countTasksByView` se retiró al quitar las seis pestañas de la pantalla de Acciones:
// contaba una consulta por vista para poner el número entre paréntesis en cada pestaña, y
// sin pestañas nadie lo llamaba. Eran seis `count` por carga de pantalla.

// ---------------------------------------------------------------------------
// Comprobaciones
// ---------------------------------------------------------------------------

async function requireTask(id: string): Promise<FollowUpTask> {
  const task = await prisma.followUpTask.findUnique({ where: { id } })
  if (!task) throw new DomainError("La tarea no existe")
  return task
}

async function assertLeadExists(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } })
  if (!lead) throw new DomainError("El contacto no existe")
}

async function assertUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) throw new DomainError("La persona asignada no existe")
}

async function assertRequestBelongsToLead(requestId: string, leadId: string): Promise<void> {
  const request = await prisma.leadRequest.findUnique({ where: { id: requestId }, select: { leadId: true } })
  if (!request || request.leadId !== leadId) {
    throw new DomainError("La solicitud indicada no pertenece a este contacto")
  }
}

export type { FollowUpStatus }
