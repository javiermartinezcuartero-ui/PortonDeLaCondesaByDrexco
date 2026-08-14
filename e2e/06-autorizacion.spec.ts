import { test, expect } from "@playwright/test"
import { FIXTURES, STORAGE_STATE } from "./accounts"
import { db } from "./database"

/**
 * Escenario 11: el rol CONTENT no accede a datos personales.
 *
 * Es la separación que sostiene el modelo de permisos: quien edita reportajes no
 * tiene por qué ver el teléfono de nadie. Se comprueba por la vía directa —la
 * URL, el endpoint— y no mirando si el enlace está oculto: un botón que no se
 * pinta no es una medida de seguridad.
 */

test.describe("CONTENT no accede a datos personales", () => {
  test.use({ storageState: STORAGE_STATE.content })

  test("11. las rutas del CRM responden 404 para CONTENT", async ({ page }) => {
    const lead = await db.lead.findUniqueOrThrow({ where: { emailNormalized: FIXTURES.existingLead.email } })
    const request = await db.leadRequest.findFirstOrThrow({ where: { leadId: lead.id } })

    for (const path of [
      "/admin/contactos",
      `/admin/contactos/${lead.id}`,
      "/admin/solicitudes",
      `/admin/solicitudes/${request.id}`,
      "/admin/pipeline",
      "/admin/tareas",
      "/admin/informes",
      "/admin/configuracion",
      "/admin/usuarios",
    ]) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} no debería ser accesible para CONTENT`).toBe(404)

      // Y, sobre todo, el dato personal no viaja en la respuesta ni siquiera
      // dentro de una página de error.
      const body = (await response?.text()) ?? ""
      expect(body, `${path} no debe contener el email del contacto`).not.toContain(FIXTURES.existingLead.email)
      expect(body, `${path} no debe contener el nombre del contacto`).not.toContain(FIXTURES.existingLead.firstName)
    }
  })

  test("11b. los endpoints de datos personales rechazan a CONTENT", async ({ page }) => {
    const lead = await db.lead.findUniqueOrThrow({ where: { emailNormalized: FIXTURES.existingLead.email } })

    for (const url of [
      "/api/admin/crm/export?conjunto=contactos",
      "/api/admin/crm/export?conjunto=solicitudes",
      `/api/admin/crm/lead-data?lead=${lead.id}`,
      "/api/admin/users",
    ]) {
      const response = await page.request.get(url)
      expect([401, 403], `${url} no debería responder ${response.status()}`).toContain(response.status())

      const body = await response.text()
      expect(body).not.toContain(FIXTURES.existingLead.email)
      expect(body).not.toContain(FIXTURES.existingLead.firstName)
    }
  })

  test("11d. esas mismas URL son las de verdad: con sesión ADMIN devuelven 200", async ({ browser }) => {
    // Sin esta comprobación, la prueba de arriba se sostenía sobre URLs que el
    // servidor no reconoce. Usaba `?entity=leads` y `?leadId=`, y los handlers leen
    // `?conjunto=` y `?lead=`: cualquier 4xx —incluido el de un parámetro
    // inexistente— hacía pasar la prueba. Bastaba con que alguien moviera el parseo
    // de parámetros por delante de la comprobación de permiso para que la regresión
    // de autorización pasara inadvertida.
    //
    // Afirmar el 200 con la sesión correcta ancla la prueba al contrato real: si un
    // nombre de parámetro cambia, esto falla y avisa.
    const context = await browser.newContext({ storageState: "e2e/.auth/admin.json" })
    const page = await context.newPage()

    try {
      const lead = await db.lead.findUniqueOrThrow({ where: { emailNormalized: FIXTURES.existingLead.email } })

      for (const url of [
        "/api/admin/crm/export?conjunto=contactos",
        "/api/admin/crm/export?conjunto=solicitudes",
        `/api/admin/crm/lead-data?lead=${lead.id}`,
        "/api/admin/users",
      ]) {
        const response = await page.request.get(url)
        expect(response.status(), `${url} debería responder 200 para ADMIN`).toBe(200)
        // Y las descargas con datos personales, siempre sin caché.
        expect(response.headers()["cache-control"], `${url} sin no-store`).toContain("no-store")
      }
    } finally {
      await context.close()
    }
  })

  test("11c. lo que sí puede hacer CONTENT sigue funcionando", async ({ page }) => {
    // La restricción no debe haber roto su propio trabajo: es la otra mitad de
    // la comprobación, y la que evita "arreglar" la autorización cerrándolo todo.
    const response = await page.goto("/admin/contenidos")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("link", { name: "Nueva ficha" }).or(page.getByRole("link", { name: /Nueva/ }))).toBeVisible()

    // Y su punto de entrada no es un error: /admin le da la bienvenida en vez de
    // un 404 (Estatus Plataforma es de CRM, que no es suyo).
    const home = await page.goto("/admin")
    expect(home?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: /Bienvenido/ })).toBeVisible()
  })
})
