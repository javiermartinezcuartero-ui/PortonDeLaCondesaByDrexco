import { test, expect } from "@playwright/test"
import { GATE_TEST_PASSWORD } from "../playwright.config"
import { uiAlert } from "./helpers"

/**
 * Escenario 14: la puerta de clave única.
 *
 * Es la pantalla por la que entra el titular, así que es la que más falta hace
 * probar de punta a punta: un fallo aquí no deja el panel a medias, lo deja
 * inaccesible. Se comprueban las tres cosas que definen su contrato — rechaza,
 * acepta, y no hay otra puerta — sin sesión previa, en contexto limpio.
 *
 * Ojo al orden: la puerta permite cinco intentos por IP cada diez minutos, y
 * estas pruebas gastan dos. Añadir más casos negativos aquí agotaría el límite y
 * el fallo se leería como un error de la puerta.
 */

test.describe("Acceso al panel con clave única", () => {
  test("14. una clave incorrecta no entra, y el mensaje no dice por qué", async ({ page }) => {
    await page.goto("/admin/login")

    await page.getByLabel("Contraseña de acceso").fill("clave-incorrecta-de-prueba")
    await page.getByRole("button", { name: "Entrar" }).click()

    await expect(uiAlert(page)).toHaveText("Contraseña incorrecta.")
    await expect(page).toHaveURL(/\/admin\/login$/)
    // El campo se vacía: no deja la clave escrita a la vista tras un fallo.
    await expect(page.getByLabel("Contraseña de acceso")).toHaveValue("")
  })

  test("14b. la clave correcta entra con Enter y da acceso completo", async ({ page }) => {
    await page.goto("/admin/login")

    // Con Enter y no con el botón: es como se usa de verdad, y es lo que el
    // titular pidió expresamente.
    await page.getByLabel("Contraseña de acceso").fill(GATE_TEST_PASSWORD)
    await page.keyboard.press("Enter")

    await page.waitForURL((url) => url.pathname === "/admin", { timeout: 20_000 })
    // La navegación del panel confirma que hay sesión de verdad, no solo una
    // redirección: se localiza por su nombre accesible porque la página incluye
    // también la navegación pública y la del pie.
    await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible()
    // Entra como ADMIN, así que están los ocho apartados, incluida Puntuación Visitantes.
    await expect(page.getByRole("link", { name: "Puntuación Visitantes" })).toBeVisible()
  })

  test("14c. no hay más puertas: el acceso por credenciales solo existe si se activa", async ({ page, baseURL }) => {
    // En el despliegue `ENABLE_CREDENTIALS_LOGIN` no está declarada y esta ruta
    // responde 404. Aquí sí lo está —la suite necesita los tres roles— así que lo
    // que se comprueba es que la ruta depende de esa variable y de nada más: que
    // responde cuando está, y que la comprobación existe. El caso cerrado se
    // prueba en `lib/auth/admin-gate.test.ts`.
    const abierta = await page.request.get(`${baseURL}/admin/login/credenciales`)
    expect(abierta.status(), "con la variable activa la ruta debe responder").toBe(200)

    // Y no está enlazada desde la pantalla de acceso: quien entra por la puerta
    // principal no ve ninguna alternativa.
    await page.goto("/admin/login")
    await expect(page.locator('a[href*="credenciales"]')).toHaveCount(0)
  })
})
