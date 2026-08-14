import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"
import type { EmailConfig } from "@/lib/email/config"
import { DIGEST_COOLDOWN_HOURS, TEMPLATE_OVERDUE, notifyOverdueTasks } from "@/lib/notifications/overdue-tasks"

/**
 * Resumen de tareas vencidas. Nada lo ejecuta automáticamente (ver
 * docs/email.md §7); lo que se prueba aquí es que, cuando se dispara, decide bien
 * qué enviar y no repite el mismo aviso.
 */

const createdEmails: string[] = []
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "id-de-prueba" }), { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()

  await prisma.notificationLog.deleteMany({ where: { template: TEMPLATE_OVERDUE } })
  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
})

function config(overrides: Partial<EmailConfig> = {}): EmailConfig {
  return {
    apiKey: "SG.clave-de-prueba",
    from: "avisos@porton.test",
    notificationTo: ["equipo@porton.test"],
    sendAcknowledgement: false,
    siteUrl: "https://porton.test",
    ...overrides,
  }
}

async function createOverdueTask(dueAt: Date) {
  const email = uniqueTestEmail("vencida")
  createdEmails.push(email.toLowerCase())
  const lead = await prisma.lead.create({
    data: { email, emailNormalized: email.toLowerCase(), firstName: "Ana", lastName: "García" },
  })
  return prisma.followUpTask.create({
    data: { leadId: lead.id, title: `Tarea vencida ${email}`, dueAt, status: "PENDING" },
  })
}

describe("notifyOverdueTasks", () => {
  itDb("sin destinatarios internos no hace nada", async () => {
    const outcome = await notifyOverdueTasks(new Date(), config({ notificationTo: [] }))

    expect(outcome).toEqual({ sent: false, reason: "no-recipients" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  itDb("sin tareas vencidas no envía un correo vacío", async () => {
    // Una fecha muy antigua como "ahora" garantiza que nada esté vencido todavía.
    const outcome = await notifyOverdueTasks(new Date("1990-01-01T00:00:00.000Z"), config())

    expect(outcome).toEqual({ sent: false, reason: "no-overdue-tasks" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  itDb("con tareas vencidas envía un único resumen y lo registra sin leadId", async () => {
    await createOverdueTask(new Date("2020-01-01T12:00:00.000Z"))
    await createOverdueTask(new Date("2020-01-02T12:00:00.000Z"))

    const outcome = await notifyOverdueTasks(new Date(), config())

    expect(outcome.sent).toBe(true)
    if (outcome.sent) {
      expect(outcome.status).toBe("SENT")
      expect(outcome.taskCount).toBeGreaterThanOrEqual(2)
    }
    // Un resumen, no un correo por tarea.
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const log = await prisma.notificationLog.findFirstOrThrow({
      where: { template: TEMPLATE_OVERDUE },
      orderBy: { createdAt: "desc" },
    })
    // El resumen habla de varios contactos: no pertenece a ninguno.
    expect(log.leadId).toBeNull()
    expect(log.status).toBe("SENT")
    expect(log.recipients).toContain("***")
    expect(log.recipients).not.toContain("equipo@porton.test")
  })

  itDb("no repite el resumen dentro de la ventana de silencio", async () => {
    await createOverdueTask(new Date("2020-01-01T12:00:00.000Z"))

    const first = await notifyOverdueTasks(new Date(), config())
    expect(first.sent).toBe(true)

    const second = await notifyOverdueTasks(new Date(), config())
    expect(second).toEqual({ sent: false, reason: "cooldown" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  itDb("vuelve a enviar cuando la ventana de silencio ya pasó", async () => {
    await createOverdueTask(new Date("2020-01-01T12:00:00.000Z"))

    await notifyOverdueTasks(new Date(), config())

    const later = new Date(Date.now() + (DIGEST_COOLDOWN_HOURS + 1) * 60 * 60 * 1000)
    const second = await notifyOverdueTasks(later, config())

    expect(second.sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  itDb("sin proveedor configurado queda SKIPPED_CONFIG y no llama a nadie", async () => {
    await createOverdueTask(new Date("2020-01-01T12:00:00.000Z"))

    const outcome = await notifyOverdueTasks(new Date(), config({ apiKey: undefined, from: undefined }))

    expect(outcome.sent).toBe(true)
    if (outcome.sent) expect(outcome.status).toBe("SKIPPED_CONFIG")
    expect(fetchMock).not.toHaveBeenCalled()

    const log = await prisma.notificationLog.findFirstOrThrow({
      where: { template: TEMPLATE_OVERDUE },
      orderBy: { createdAt: "desc" },
    })
    expect(log.provider).toBe("development")
  })

  itDb("un fallo del proveedor no rompe nada y queda registrado", async () => {
    const task = await createOverdueTask(new Date("2020-01-01T12:00:00.000Z"))
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    const outcome = await notifyOverdueTasks(new Date(), config())

    expect(outcome.sent).toBe(true)
    if (outcome.sent) expect(outcome.status).toBe("RETRY_PENDING")
    // La tarea sigue igual: el correo no cambia el estado del CRM.
    const unchanged = await prisma.followUpTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(unchanged.status).toBe("PENDING")
  })

  itDb("el correo enlaza a la vista de vencidas del panel", async () => {
    await createOverdueTask(new Date("2020-01-01T12:00:00.000Z"))

    await notifyOverdueTasks(new Date(), config({ siteUrl: "https://porton.test" }))

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))
    const html = body.html as string
    expect(html).toContain("https://porton.test/admin/tareas?vista=vencidas")
    expect(html).not.toContain("token")
  })
})
