import { test, expect } from "@playwright/test"
import { FIXTURES, STORAGE_STATE } from "./accounts"
import { db } from "./database"
import { uiAlert } from "./helpers"

/**
 * Escenario 10: el comercial ve una solicitud, crea una tarea y cambia el
 * estado. Es el ciclo mínimo que convierte el CRM en algo usable, y el que
 * demuestra que las tres cosas quedan enlazadas: solicitud, tarea e historial.
 */

test.describe("CRM con rol SALES", () => {
  test.use({ storageState: STORAGE_STATE.sales })

  test("10. el comercial ve la solicitud, crea una tarea y mueve el estado", async ({ page }) => {
    // --- Ve la solicitud en el listado --------------------------------------
    await page.goto("/admin/solicitudes")

    const row = page.getByRole("link", { name: FIXTURES.existingLead.subject })
    await expect(row).toBeVisible()
    await row.click()

    await expect(page).toHaveURL(/\/admin\/solicitudes\/[a-z0-9]+$/)
    const requestId = page.url().split("/").pop() as string

    // El detalle muestra el mensaje y el contacto: es lo que el comercial
    // necesita para llamar.
    await expect(page.getByText("Mensaje ficticio sembrado para las pruebas del CRM.")).toBeVisible()
    await expect(page.getByText(FIXTURES.existingLead.email)).toBeVisible()

    // --- Crea una tarea -----------------------------------------------------
    // Las tareas se crean desde la ficha del contacto, que es donde vive su
    // seguimiento completo.
    const lead = await db.lead.findUniqueOrThrow({ where: { emailNormalized: FIXTURES.existingLead.email } })
    await page.goto(`/admin/contactos/${lead.id}`)

    await page.locator("#tarea-titulo").fill("Llamar para concretar la visita")
    await page.locator("#tarea-fecha").fill("2026-09-30")
    await page.locator("#tarea-prioridad").selectOption("HIGH")
    // Se asigna al propio comercial: una tarea sin responsable no aparece en la
    // vista "Mías", que es la que se abre por defecto, y quedaría en el limbo.
    await page.locator("#tarea-responsable").selectOption({ label: "Comercial de pruebas E2E" })
    // La tarea se ata a la solicitud: sin eso, el seguimiento pierde el contexto.
    await page.locator("#tarea-solicitud").selectOption(requestId)
    await page.getByRole("button", { name: "Crear tarea" }).click()

    await expect(page.getByText("Llamar para concretar la visita")).toBeVisible({ timeout: 20_000 })

    const task = await db.followUpTask.findFirstOrThrow({
      where: { leadId: lead.id, title: "Llamar para concretar la visita" },
    })
    expect(task.status).toBe("PENDING")
    expect(task.priority).toBe("HIGH")

    // El enlace con la solicitud no es una columna de `FollowUpTask`: queda en la
    // actividad que la creación registra (`lib/domain/tasks.ts`). La tarea se ata
    // al contacto, y el contexto de "para qué solicitud" vive en el historial. Es
    // una limitación conocida y está anotada en el README §Limitaciones conocidas.
    const creationActivity = await db.leadActivity.findFirstOrThrow({
      where: { leadId: lead.id, leadRequestId: requestId, type: "NOTE" },
      orderBy: { createdAt: "desc" },
    })
    expect(JSON.stringify(creationActivity.metadata)).toContain(task.id)

    expect(task.assigneeId).toBeTruthy()

    // Y aparece en la pantalla de Acciones, no solo en la ficha del contacto. Esa
    // pantalla es una tabla con todas las acciones, editable en la propia celda: el
    // título vive en un campo de texto, así que se comprueba por su valor.
    await page.goto("/admin/tareas")
    // Por el nombre accesible exacto del campo del título. Con una expresión regular
    // parcial se resolvían dos elementos: el propio título y el campo de fecha, cuyo
    // nombre accesible es «Fecha de vencimiento de <título>» y contiene el título dentro.
    await expect(page.getByRole("textbox", { name: "Acción: Llamar para concretar la visita" })).toHaveValue(
      "Llamar para concretar la visita"
    )

    // --- Cambia el estado ---------------------------------------------------
    await page.goto(`/admin/solicitudes/${requestId}`)
    // Desde Contacto, el dominio solo permite Presentación o Perdida (ALLOWED_TRANSITIONS).
    await page.locator(`#estado-${requestId}`).selectOption("PRESENTATION")
    await page.getByRole("button", { name: "Mover" }).click()

    await expect
      .poll(async () => (await db.leadRequest.findUniqueOrThrow({ where: { id: requestId } })).status, {
        timeout: 20_000,
      })
      .toBe("PRESENTATION")

    // El movimiento deja rastro por duplicado: actividad para el comercial y
    // evento de auditoría para quien tenga que responder de él.
    const activity = await db.leadActivity.findFirstOrThrow({
      where: { leadId: lead.id, type: "STATUS_CHANGED" },
      orderBy: { createdAt: "desc" },
    })
    expect(activity.leadRequestId).toBe(requestId)

    const audit = await db.auditEvent.findFirstOrThrow({
      where: { entityType: "LeadRequest", entityId: requestId },
      orderBy: { createdAt: "desc" },
    })
    expect(audit.actorId).toBeTruthy()

    // Y se ve en el historial de la propia solicitud, con la transición traducida.
    await page.reload()
    await expect(page.getByText(/Contacto → Presentación/).first()).toBeVisible()
  })

  test("10b. marcar como perdida exige un motivo", async ({ page }) => {
    const lead = await db.lead.findUniqueOrThrow({ where: { emailNormalized: FIXTURES.existingLead.email } })
    const request = await db.leadRequest.findFirstOrThrow({ where: { leadId: lead.id } })

    await page.goto(`/admin/solicitudes/${request.id}`)
    await page.locator(`#estado-${request.id}`).selectOption("LOST")

    // Al elegir LOST aparece el campo de motivo: es obligatorio porque una
    // oportunidad perdida sin motivo no sirve para aprender nada.
    const reason = page.locator(`#motivo-${request.id}`)
    await expect(reason).toBeVisible()

    // Se envía sin motivo: debe rechazarse en servidor.
    await page.getByRole("button", { name: /Mover|Marcar/ }).first().click()
    await expect(uiAlert(page)).toBeVisible({ timeout: 15_000 })

    const unchanged = await db.leadRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(unchanged.status).not.toBe("LOST")
  })
})
