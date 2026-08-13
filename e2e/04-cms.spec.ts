import { test, expect } from "@playwright/test"
import { STORAGE_STATE } from "./accounts"
import { db } from "./database"
import { makePng } from "./image-fixture"
import { newVisitor, unlockVipGate, uniqueEmail } from "./helpers"

/**
 * Escenarios 8 y 9: el editor de contenido crea un borrador, sube una imagen,
 * previsualiza, publica, y lo publicado aparece en su ruta pública.
 *
 * El recorrido se hace completo con el rol CONTENT y sin atajos: la ficha se
 * crea por el formulario, la imagen se sube por el input de archivo real, y la
 * publicación se hace con el botón del editor. La subida va contra el bucket de
 * Supabase de verdad (no hay equivalente local) y `scripts/e2e-seed.ts` borra
 * después los objetos que dejaron las pruebas.
 */

const SLUG = "reportaje-e2e-publicado"
const TITLE = "Reportaje E2E publicado"

test.describe("CMS con rol CONTENT", () => {
  test.use({ storageState: STORAGE_STATE.content })

  test("8 y 9. borrador → imagen → previsualización → publicación → ruta pública", async ({ page }) => {
    // --- Borrador -----------------------------------------------------------
    await page.goto("/admin/contenidos/nuevo")

    await page.getByRole("radio", { name: "Boda real" }).check()
    await page.locator("#title").fill(TITLE)
    // El slug se sugiere solo a partir del título; se fija a mano para que la
    // prueba no dependa de la transliteración.
    await page.locator("#slug").fill(SLUG)
    await page.getByRole("button", { name: "Crear borrador" }).click()

    // La acción redirige al editor de la ficha recién creada. El patrón exige un
    // cuid (empieza por "c" y es largo) y no un `[a-z0-9]+` cualquiera: si no,
    // también encajaría la propia URL de partida, `/admin/contenidos/nuevo`, y la
    // prueba seguiría creyendo que ya ha navegado.
    await expect(page).toHaveURL(/\/admin\/contenidos\/c[a-z0-9]{20,}$/, { timeout: 20_000 })
    const entryId = page.url().split("/").pop() as string

    const draft = await db.contentEntry.findUniqueOrThrow({ where: { id: entryId } })
    expect(draft.status).toBe("DRAFT")
    expect(draft.slug).toBe(SLUG)

    // Un borrador no está en la web pública, aunque se sepa su slug. Sin sesión
    // VIP la respuesta es el gate (200) y no un 404: la existencia de un slug no
    // se confirma a quien no ha entrado, así que no se puede enumerar el catálogo
    // desde fuera. Lo que se comprueba es que el contenido no viaja.
    const anonymous = await page.request.get(`/bodas-reales/${SLUG}`)
    expect(anonymous.status()).toBe(200)
    expect(await anonymous.text()).not.toContain(TITLE)

    // --- Imagen -------------------------------------------------------------
    // Si Storage no está configurado el editor lo dice y deshabilita el input.
    // Se comprueba explícitamente en vez de dejar que la prueba falle con un
    // error confuso: la causa es de entorno, no del código.
    await expect(
      page.getByText("Supabase Storage no está configurado en este entorno"),
      "esta prueba necesita SUPABASE_URL y la clave privilegiada (ver docs/pruebas-e2e.md §3)"
    ).toHaveCount(0)

    await page.locator("#media-upload").setInputFiles({
      name: "reportaje-e2e.png",
      mimeType: "image/png",
      buffer: makePng(600),
    })

    // La media aparece cuando el servidor ya la ha guardado y la página se ha
    // refrescado.
    const altField = page.locator('[id^="media-alt-"]').first()
    await expect(altField).toBeVisible({ timeout: 30_000 })

    const uploaded = await db.contentMedia.findFirstOrThrow({ where: { contentEntryId: entryId } })
    expect(uploaded.mimeType).toBe("image/png")
    expect(uploaded.width).toBe(600)
    // El nombre del objeto lo decide el servidor: nunca el del archivo subido.
    expect(uploaded.storagePath).not.toContain("reportaje-e2e.png")
    expect(uploaded.storagePath).toContain(entryId)

    // Publicar exige alt en la imagen principal, así que aquí se rellena y se
    // marca como hero. Es parte del recorrido, no un requisito artificial.
    await altField.fill("Pareja bajo los olivos, imagen de pruebas")
    await page.getByRole("radio", { name: /principal|hero/i }).first().check()
    await page.getByRole("button", { name: "Guardar", exact: true }).click()
    await expect(page.getByText("Guardado")).toBeVisible({ timeout: 20_000 })

    // --- Previsualización ---------------------------------------------------
    await page.getByRole("link", { name: /Previsualizar/ }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/contenidos/${entryId}/preview$`))
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible()

    // Previsualizar no publica: la ficha sigue siendo un borrador.
    expect((await db.contentEntry.findUniqueOrThrow({ where: { id: entryId } })).status).toBe("DRAFT")

    // --- Publicación --------------------------------------------------------
    await page.goto(`/admin/contenidos/${entryId}`)
    await page.getByRole("button", { name: "Publicar" }).click()

    await expect
      .poll(async () => (await db.contentEntry.findUniqueOrThrow({ where: { id: entryId } })).status, {
        timeout: 20_000,
      })
      .toBe("PUBLISHED")

    const published = await db.contentEntry.findUniqueOrThrow({ where: { id: entryId } })
    expect(published.publishedAt).not.toBeNull()

    // La publicación queda auditada, con actor.
    const audit = await db.auditEvent.findFirstOrThrow({
      where: { entityType: "ContentEntry", entityId: entryId, action: "content.publish" },
    })
    expect(audit.actorId).toBeTruthy()

    // --- 9. Aparece en la ruta correcta ------------------------------------
    // La ficha es de boda: debe estar en /bodas-reales y **no** en /catering.
    // Se abre un visitante aparte, con su propia IP: el editor tiene sesión de
    // panel, no de acceso VIP, y son cosas distintas.
    const { context: visitor, page: visitorPage } = await newVisitor(page.context().browser()!, 31)
    await unlockVipGate(visitorPage, uniqueEmail("publicacion"), "/bodas-reales")

    await expect(visitorPage.getByRole("link", { name: new RegExp(TITLE, "i") })).toBeVisible()

    await visitorPage.goto(`/bodas-reales/${SLUG}`)
    await expect(visitorPage.getByRole("heading", { name: TITLE })).toBeVisible()

    await visitorPage.goto("/catering")
    await expect(visitorPage.getByRole("link", { name: new RegExp(TITLE, "i") })).toHaveCount(0)

    // Y no se sirve por la ruta de la otra biblioteca.
    const wrongRoute = await visitorPage.request.get(`/catering/${SLUG}`)
    expect(wrongRoute.status()).toBe(404)

    await visitor.close()
  })
})
