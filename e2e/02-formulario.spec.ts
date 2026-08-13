import { test, expect } from "@playwright/test"
import { FIXTURES } from "./accounts"
import { db } from "./database"
import { chooseOption, marketingCheckbox, newVisitor, privacyCheckbox, unlockVipGate, uniqueEmail } from "./helpers"

/**
 * Escenario 6: el CTA contextual de una ficha crea una LeadRequest atribuida a
 * esa ficha.
 *
 * Es el recorrido que da sentido a toda la biblioteca VIP: alguien mira una boda
 * concreta, dice "quiero una boda así" y la solicitud llega al CRM sabiendo qué
 * estaba mirando.
 */

test.describe("Formulario comercial", () => {
  test("6. el CTA de una ficha crea una LeadRequest con su ficha de origen", async ({ browser }) => {
    const { context, page } = await newVisitor(browser, 21)
    const visitorEmail = uniqueEmail("solicitud")
    const entry = await db.contentEntry.findFirstOrThrow({ where: { slug: FIXTURES.wedding.slug } })

    // Se llega al CTA por donde se llega de verdad: la ficha.
    await unlockVipGate(page, visitorEmail, "/bodas-reales")
    await page.goto(`/bodas-reales/${FIXTURES.wedding.slug}`)

    await page.getByRole("link", { name: "Quiero una boda así" }).click()

    // El CTA lleva a la home con el tipo y la ficha en la URL.
    await expect(page).toHaveURL(new RegExp(`tipo=WEDDING.*ficha=${entry.id}`))

    // El formulario llega precargado: el tipo de evento ya está elegido y el
    // asunto es el texto del propio botón que se pulsó, así que la persona no
    // tiene que repetir lo que el sitio ya sabe.
    await expect(page.getByLabel("Tipo de evento")).toContainText("Boda")
    await expect(page.getByLabel("Asunto")).toHaveValue("Quiero una boda así")

    await page.getByLabel("Nombre", { exact: true }).fill("Lucía")
    await page.getByLabel("Apellidos").fill("Pérez Ficticia")
    await page.getByLabel("Email", { exact: true }).fill(visitorEmail)
    await page.getByLabel(/Teléfono/).fill("+34 600 111 222")
    await page.getByLabel("Mensaje").fill("Nos ha encantado esta boda. ¿Podemos visitar la finca?")

    // Espacio: es el único desplegable obligatorio que queda por tocar.
    await chooseOption(page, "Espacio que te interesa", "Salón Portón")

    await privacyCheckbox(page).click()
    // El marketing se deja sin marcar a propósito: no se exige para enviar.
    await expect(marketingCheckbox(page)).not.toBeChecked()

    // El formulario exige un tiempo mínimo de relleno (MIN_FORM_FILL_MS = 3 s)
    // como filtro antibot. Rellenarlo a velocidad de máquina lo dispara, así que
    // se espera: no se está sorteando la protección, se está siendo humano.
    await page.waitForTimeout(3_500)

    await page.getByRole("button", { name: "Solicitar información" }).click()

    await expect(page.getByText("Solicitud recibida")).toBeVisible({ timeout: 20_000 })

    // ---------------------------------------------------------------------
    // Lo que tiene que haber quedado en la base
    // ---------------------------------------------------------------------
    const lead = await db.lead.findUniqueOrThrow({
      where: { emailNormalized: visitorEmail },
      include: { requests: true, consents: true, activities: true },
    })

    expect(lead.requests).toHaveLength(1)
    const request = lead.requests[0]

    // El tipo de evento llegó precargado del CTA y viaja sin que nadie lo
    // vuelva a elegir. La prueba no toca ese desplegable a propósito: hacerlo
    // ocultaría un fallo de precarga (pasó exactamente eso en la Fase 6).
    expect(request.eventType).toBe("WEDDING")
    // La atribución a la ficha: sin esto, el comercial no sabe de qué venía.
    expect(request.sourceContentId).toBe(entry.id)
    // Origen distinto del formulario de la home: la solicitud nació en una ficha.
    expect(request.sourceForm).toBe("vip-story-cta")
    expect(request.status).toBe("NEW")

    // Privacidad concedida con versión de política; marketing denegado.
    const privacy = lead.consents.find((event) => event.purpose === "PRIVACY" && event.granted)
    expect(privacy?.policyVersion).toBeTruthy()
    expect(lead.consents.some((event) => event.purpose === "MARKETING" && event.granted)).toBe(false)

    // Actividad del envío, para el historial del contacto.
    expect(lead.activities.some((activity) => activity.type === "FORM_SUBMITTED")).toBe(true)

    // Y el correo: sin transporte configurado, el intento queda registrado como
    // SKIPPED_CONFIG. Es la prueba de que guardar la solicitud **no depende** de
    // que SendGrid responda, que es el principio de la Fase 8.
    await expect
      .poll(() => db.notificationLog.count({ where: { leadId: lead.id } }), { timeout: 15_000 })
      .toBeGreaterThan(0)
    const notifications = await db.notificationLog.findMany({ where: { leadId: lead.id } })
    expect(notifications.every((log) => log.status === "SKIPPED_CONFIG")).toBe(true)

    await context.close()
  })

  test("6b. sin aceptar la privacidad no se envía nada", async ({ browser }) => {
    const { context, page } = await newVisitor(browser, 22)
    const email = uniqueEmail("sin-privacidad")

    await page.goto("/#contacto")
    await page.getByLabel("Nombre", { exact: true }).fill("Nadie")
    await page.getByLabel("Apellidos").fill("Sin Consentimiento")
    await page.getByLabel("Email", { exact: true }).fill(email)
    await page.getByLabel("Asunto").fill("Prueba sin consentimiento")
    await page.getByLabel("Mensaje").fill("Este mensaje no debe llegar a la base de datos.")

    await chooseOption(page, "Tipo de evento", "Boda")
    await chooseOption(page, "Espacio que te interesa", "Salón Portón")

    await page.waitForTimeout(3_500)
    await page.getByRole("button", { name: "Solicitar información" }).click()

    await expect(page.getByText("Debes aceptar la política de privacidad")).toBeVisible()
    await expect(page.getByText("Solicitud recibida")).toHaveCount(0)

    expect(await db.lead.findUnique({ where: { emailNormalized: email } })).toBeNull()

    await context.close()
  })
})
