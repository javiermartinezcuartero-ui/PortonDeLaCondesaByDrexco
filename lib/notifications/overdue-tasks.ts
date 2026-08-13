import "server-only"

import { prisma } from "@/lib/db"
import { readEmailConfig, resolveEmailProvider, type EmailConfig } from "@/lib/email"
import type { EmailSendResult } from "@/lib/email/provider"
import { buildOverdueTasksDigest, type OverdueTaskSummary } from "@/lib/email/templates"
import { leadName } from "@/lib/crm/labels"
import { recordNotification } from "@/lib/notifications/record"

/**
 * Resumen interno de tareas vencidas.
 *
 * **Nada lo ejecuta automáticamente.** El proyecto no tiene cron, y el enunciado de
 * esta fase pide no añadir cola externa, así que la pieza existe y funciona pero
 * hay que dispararla: `npm run notify:overdue`. No se ha creado un endpoint HTTP
 * para ello a propósito —un endpoint que envía correos y no exige sesión es una vía
 * de abuso—; conectarlo a un programador (Vercel Cron u otro) es el paso pendiente,
 * documentado como evolución en docs/email.md §7.
 *
 * Se envía **un resumen**, no un correo por tarea: diez tareas vencidas son un
 * problema de agenda, no diez avisos.
 */

export const TEMPLATE_OVERDUE = "tasks-overdue-digest"

/**
 * Ventana de silencio entre resúmenes. Si el disparador se ejecutara varias veces
 * al día, esto evita repetir el mismo aviso; y como el estado se lee de
 * `NotificationLog`, funciona igual aunque cada ejecución sea un proceso distinto.
 */
export const DIGEST_COOLDOWN_HOURS = 20

/** Tope de tareas listadas. Un correo no es un listado paginado. */
export const DIGEST_MAX_TASKS = 25

export type OverdueDigestOutcome =
  | { sent: false; reason: "no-overdue-tasks" | "cooldown" | "no-recipients" }
  | { sent: true; status: EmailSendResult["status"]; taskCount: number }

export async function notifyOverdueTasks(
  now: Date = new Date(),
  config: EmailConfig = readEmailConfig()
): Promise<OverdueDigestOutcome> {
  if (config.notificationTo.length === 0) return { sent: false, reason: "no-recipients" }

  const cooldownSince = new Date(now.getTime() - DIGEST_COOLDOWN_HOURS * 60 * 60 * 1000)
  const recent = await prisma.notificationLog.findFirst({
    where: { template: TEMPLATE_OVERDUE, createdAt: { gte: cooldownSince }, status: { in: ["SENT", "SKIPPED_CONFIG"] } },
    select: { id: true },
  })
  if (recent) return { sent: false, reason: "cooldown" }

  const tasks = await prisma.followUpTask.findMany({
    where: { status: "PENDING", dueAt: { lt: now } },
    orderBy: { dueAt: "asc" },
    take: DIGEST_MAX_TASKS,
    select: {
      id: true,
      title: true,
      dueAt: true,
      leadId: true,
      lead: { select: { firstName: true, lastName: true, email: true } },
      assignee: { select: { name: true } },
    },
  })

  if (tasks.length === 0) return { sent: false, reason: "no-overdue-tasks" }

  const summaries: OverdueTaskSummary[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueAt: task.dueAt,
    leadId: task.leadId,
    leadLabel: leadName(task.lead),
    assigneeName: task.assignee?.name ?? null,
  }))

  const provider = resolveEmailProvider(config)
  const content = buildOverdueTasksDigest(summaries, config.siteUrl)

  let result: EmailSendResult
  try {
    result = await provider.send({
      to: config.notificationTo,
      subject: content.subject,
      html: content.html,
      text: content.text,
    })
  } catch (error) {
    result = {
      status: "FAILED",
      reason: `el proveedor lanzó: ${error instanceof Error ? error.message : "error desconocido"}`,
    }
  }

  // Sin `leadId`: el resumen habla de varios contactos y no pertenece a ninguno.
  await recordNotification({
    leadId: null,
    template: TEMPLATE_OVERDUE,
    provider: provider.name,
    recipients: config.notificationTo,
    result,
  })

  return { sent: true, status: result.status, taskCount: tasks.length }
}
