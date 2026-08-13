import { test, expect } from "@playwright/test"
import { FIXTURES } from "./accounts"
import { db } from "./database"
import { marketingCheckbox, newVisitor, privacyCheckbox, uiAlert, unlockVipGate, uniqueEmail } from "./helpers"

/**
 * Escenarios 1 a 5: el recorrido del visitante por las bibliotecas VIP.
 *
 * Cada prueba abre su propio navegador con una IP ficticia distinta (`newVisitor`):
 * son visitantes diferentes, no una misma persona insistiendo. Así ninguna prueba
 * hereda la cookie de acceso de otra ni le consume su cupo en el límite del gate.
 */

test.describe("Bibliotecas VIP", () => {
  test("1. el visitante entra en /bodas-reales y ve el gate, no el contenido", async ({ browser }) => {
    const { context, page } = await newVisitor(browser, 11)

    const response = await page.goto("/bodas-reales")

    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: /Accede a la biblioteca de bodas reales/i })).toBeVisible()

    // Lo que de verdad importa: sin sesión, el contenido protegido no está en la
    // respuesta. No es que esté oculto por CSS ni difuminado; no se ha
    // consultado. Se comprueba sobre el HTML servido, no sobre el DOM ya
    // hidratado, porque es el HTML lo que vería quien mirase el código fuente.
    const html = (await response?.text()) ?? ""
    expect(html).not.toContain(FIXTURES.wedding.title)
    expect(html).not.toContain(FIXTURES.wedding.slug)

    await context.close()
  })

  test("2. la privacidad es obligatoria: sin aceptarla no se concede acceso", async ({ browser }) => {
    const { context, page } = await newVisitor(browser, 12)
    const email = uniqueEmail("privacidad")

    await page.goto("/bodas-reales")
    await page.locator("#vip-email").fill(email)
    // A propósito: NO se marca la casilla de privacidad.
    await page.getByRole("button", { name: "Acceder" }).click()

    await expect(uiAlert(page)).toHaveText(/Debes aceptar la política de privacidad/i)

    // Sigue viéndose el gate y el email escrito no se ha perdido.
    await expect(page.getByRole("heading", { name: /Accede a la biblioteca/i })).toBeVisible()
    await expect(page.locator("#vip-email")).toHaveValue(email)

    // Y no se ha creado ni contacto ni sesión de acceso para ese email.
    expect(await db.lead.findUnique({ where: { emailNormalized: email } })).toBeNull()

    await context.close()
  })

  test("2b. el marketing es opcional y por separado: se envía sin marcarlo", async ({ browser }) => {
    const { context, page } = await newVisitor(browser, 13)
    const email = uniqueEmail("marketing")

    await page.goto("/bodas-reales")
    // Las dos casillas empiezan sin marcar: ningún consentimiento viene puesto.
    await expect(privacyCheckbox(page)).not.toBeChecked()
    await expect(marketingCheckbox(page)).not.toBeChecked()

    await page.locator("#vip-email").fill(email)
    await privacyCheckbox(page).click()
    await page.getByRole("button", { name: "Acceder" }).click()

    await expect(page.getByRole("heading", { name: FIXTURES.wedding.title })).toBeVisible({ timeout: 20_000 })

    const lead = await db.lead.findUniqueOrThrow({
      where: { emailNormalized: email },
      include: { consents: true },
    })

    // Privacidad: evento concedido, con la versión de política que se aceptó.
    const privacy = lead.consents.find((event) => event.purpose === "PRIVACY")
    expect(privacy?.granted).toBe(true)
    expect(privacy?.policyVersion).toBeTruthy()

    // Marketing: no hay ningún evento. Es deliberado —ver el comentario en
    // `lib/domain/vip-access.ts`—: una casilla que se deja como estaba no es una
    // decisión que haya que archivar. El estado del consentimiento es el último
    // evento registrado, así que "sin eventos" significa "nunca concedido"; no hay
    // ninguna columna que pueda contradecirlo. Lo que importa es que **no** se ha
    // concedido nada por arrastre del consentimiento de privacidad.
    expect(lead.consents.filter((event) => event.purpose === "MARKETING")).toHaveLength(0)

    await context.close()
  })

  test("3. un correo válido desbloquea las dos bibliotecas", async ({ browser }) => {
    const { context, page } = await newVisitor(browser, 14)
    const email = uniqueEmail("acceso")

    // Se entra por bodas…
    await unlockVipGate(page, email, "/bodas-reales")
    await expect(page.getByRole("heading", { name: FIXTURES.wedding.title })).toBeVisible()

    // …y catering queda desbloqueado sin volver a pedir nada. Es el compromiso
    // que el propio gate anuncia ("acceso completo a las dos bibliotecas").
    await page.goto("/catering")
    await expect(page.getByRole("heading", { name: FIXTURES.catering.title })).toBeVisible()
    await expect(page.getByRole("heading", { name: /Accede a la biblioteca/i })).toHaveCount(0)

    // Una sola sesión de acceso, no una por biblioteca.
    const lead = await db.lead.findUniqueOrThrow({ where: { emailNormalized: email }, include: { vipSessions: true } })
    expect(lead.vipSessions).toHaveLength(1)

    await context.close()
  })

  test("4 y 5. el visitante abre una ficha, se registra la interacción y una recarga no la duplica", async ({
    browser,
  }) => {
    const { context, page } = await newVisitor(browser, 15)
    const email = uniqueEmail("ficha")

    await unlockVipGate(page, email, "/bodas-reales")
    const lead = await db.lead.findUniqueOrThrow({ where: { emailNormalized: email } })

    // Vista del listado. Se registra desde el cliente tras montar, así que se
    // espera a que aparezca en vez de asumir que ya está.
    await expect
      .poll(
        () =>
          db.contentInteraction.count({
            where: { leadId: lead.id, type: "SECTION_VIEWED", section: "REAL_WEDDING" },
          }),
        { timeout: 15_000 }
      )
      .toBe(1)

    // --- 4. Abre la ficha desde la tarjeta del listado ----------------------
    await page
      .getByRole("link", { name: new RegExp(FIXTURES.wedding.title, "i") })
      .first()
      .click()

    await expect(page).toHaveURL(new RegExp(`/bodas-reales/${FIXTURES.wedding.slug}$`))
    await expect(page.getByRole("heading", { name: FIXTURES.wedding.title })).toBeVisible()
    // Detalle que solo existe en la ficha, no en la tarjeta del listado.
    await expect(page.getByText("Ceremonia en el jardín")).toBeVisible()

    // --- 5. La interacción con la ficha queda registrada, con su ficha ------
    const entry = await db.contentEntry.findFirstOrThrow({ where: { slug: FIXTURES.wedding.slug } })

    await expect
      .poll(
        () =>
          db.contentInteraction.count({
            where: { leadId: lead.id, type: "CONTENT_VIEWED", contentEntryId: entry.id },
          }),
        { timeout: 15_000 }
      )
      .toBe(1)

    // Recargar no es una visita nueva: `recordContentViewOnce` deduplica en una
    // ventana de 30 minutos. Sin esto, un F5 inflaría el scoring del contacto.
    await page.reload()
    await page.waitForTimeout(2_000)
    expect(
      await db.contentInteraction.count({
        where: { leadId: lead.id, type: "CONTENT_VIEWED", contentEntryId: entry.id },
      })
    ).toBe(1)

    // El acceso VIP puntúa: el contacto deja de estar a cero.
    const scored = await db.lead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(scored.score).toBeGreaterThan(0)

    await context.close()
  })
})
