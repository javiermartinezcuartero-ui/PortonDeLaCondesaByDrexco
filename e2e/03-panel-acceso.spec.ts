import { test, expect } from "@playwright/test"
import { ACCOUNTS, STORAGE_STATE } from "./accounts"
import { db } from "./database"
import { loginAs, uiAlert } from "./helpers"

/**
 * Escenarios 7, 12 y 13: entrada al panel, puerta cerrada para quien no tiene
 * sesión, y salida que de verdad revoca.
 */

test.describe("Acceso al panel", () => {
  test("7. el administrador inicia sesión con el formulario real", async ({ page }) => {
    await loginAs(page, "admin")

    await expect(page).toHaveURL(/\/admin$/)
    // Que hay sesión se comprueba por el encabezado de la pantalla, no buscando el
    // texto "ADMIN". Aquello funcionaba por accidente: coincidía con la palabra
    // "administración" del rótulo del panel, y dejó de encontrarse en cuanto el rótulo
    // cambió. Lo que confirma el rol es la lista de apartados de más abajo: solo un
    // ADMIN ve Puntuación Visitantes.
    await expect(page.getByRole("heading", { name: "Estatus Plataforma", level: 1 })).toBeVisible()

    // ADMIN ve todos los apartados, incluidos los que otros roles no ven.
    const nav = page.getByRole("navigation", { name: "Secciones del panel" })
    for (const label of [
      "Estatus Plataforma",
      "Captaciones",
      "Solicitudes Formulario",
      "Seguimiento clientes",
      "Acciones",
      "Contenidos Biblioteca",
      "Informes captación",
      "Puntuación Visitantes",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible()
    }

    // Y queda una sesión en base de datos, sin IP ni user-agent: la
    // minimización de la Fase 9 no es una promesa del texto legal.
    const user = await db.user.findUniqueOrThrow({
      where: { email: ACCOUNTS.admin.email.toLowerCase() },
      include: { sessions: true },
    })
    expect(user.sessions.length).toBeGreaterThan(0)
    expect(user.sessions.every((session) => !session.ipAddress && !session.userAgent)).toBe(true)
  })

  test("7b. una contraseña incorrecta no entra y el mensaje no revela nada", async ({ page }) => {
    await page.goto("/admin/login/credenciales")
    await page.locator("#email").fill(ACCOUNTS.admin.email)
    await page.locator("#password").fill("contrasena-incorrecta-ficticia")
    await page.getByRole("button", { name: "Entrar" }).click()

    const alert = uiAlert(page)
    await expect(alert).toBeVisible()
    // El mensaje es el mismo que para un email inexistente: no permite deducir
    // qué cuentas existen.
    await expect(alert).toHaveText("Email o contraseña incorrectos.")
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test("12. sin sesión no se accede a ninguna ruta del panel", async ({ page }) => {
    // Contexto limpio, sin storageState: es el visitante anónimo.
    for (const path of [
      "/admin",
      "/admin/contactos",
      "/admin/solicitudes",
      "/admin/pipeline",
      "/admin/tareas",
      "/admin/contenidos",
      "/admin/informes",
      "/admin/configuracion",
      "/admin/usuarios",
    ]) {
      await page.goto(path)
      await expect(page, `${path} debería llevar al login`).toHaveURL(/\/admin\/login/)
    }
  })

  test("12b. los endpoints privados responden sin sesión sin filtrar datos", async ({ request }) => {
    for (const path of ["/api/admin/crm/export?conjunto=contactos", "/api/admin/users"]) {
      const response = await request.get(path)
      expect([401, 403], `${path} no debería responder ${response.status()}`).toContain(response.status())

      const body = await response.text()
      // Ni datos, ni rastro del motor de base de datos, ni stack.
      expect(body).not.toContain("@")
      expect(body.toLowerCase()).not.toContain("prisma")
      expect(body).not.toContain("at ")
    }
  })

  test("13. cerrar sesión revoca la sesión: la cookie anterior deja de servir", async ({ browser }) => {
    // Contexto propio para no invalidar el storageState compartido de los demás
    // escenarios: cerrar sesión aquí borraría la fila que ellos reutilizan.
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, "sales")

    const cookies = await context.cookies()
    const sessionCookie = cookies.find((cookie) => cookie.name.includes("session_token"))
    expect(sessionCookie, "debería existir una cookie de sesión").toBeTruthy()

    const before = await db.session.count()
    expect(before).toBeGreaterThan(0)

    // El botón se llama «Salir» desde el rediseño del panel, no «Cerrar sesión».
    await page.getByRole("button", { name: "Salir" }).click()
    await expect(page).toHaveURL(/\/admin\/login/)

    // La fila de sesión ya no existe: no es solo que se haya borrado la cookie
    // del navegador. Si solo se borrase la cookie, quien la hubiera copiado
    // seguiría dentro.
    await expect.poll(() => db.session.count(), { timeout: 10_000 }).toBeLessThan(before)

    // Se vuelve a poner la cookie a mano y se intenta entrar: el servidor la
    // rechaza porque valida la sesión contra la base de datos, no la presencia
    // de la cookie.
    await context.addCookies([sessionCookie!])
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/login/)

    await context.close()
  })
})

test.describe("Acceso con sesión de comercial", () => {
  test.use({ storageState: STORAGE_STATE.sales })

  test("12c. SALES no ve los apartados que no le corresponden, y tampoco puede entrar por URL", async ({ page }) => {
    await page.goto("/admin")

    const nav = page.getByRole("navigation", { name: "Secciones del panel" })
    await expect(nav.getByRole("link", { name: "Captaciones" })).toBeVisible()
    // Contenidos Biblioteca y Puntuación Visitantes no son suyos.
    await expect(nav.getByRole("link", { name: "Contenidos Biblioteca" })).toHaveCount(0)
    await expect(nav.getByRole("link", { name: "Puntuación Visitantes" })).toHaveCount(0)

    // Y ocultar el enlace no es la protección: escribiendo la ruta a mano
    // tampoco entra.
    for (const path of ["/admin/contenidos", "/admin/configuracion", "/admin/usuarios"]) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} debería responder 404 para SALES`).toBe(404)
    }

    // La exportación es solo de ADMIN.
    const download = await page.request.get("/api/admin/crm/export?conjunto=contactos")
    expect(download.status()).toBe(403)
  })
})
