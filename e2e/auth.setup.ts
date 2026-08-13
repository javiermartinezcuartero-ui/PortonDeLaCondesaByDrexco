import { test as setup, expect } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { STORAGE_STATE, type Role } from "./accounts"
import { loginAs } from "./helpers"

/**
 * Inicia sesión una vez por rol y guarda el estado del navegador.
 *
 * Los escenarios que necesitan estar autenticados reutilizan estos estados en
 * vez de repetir el login: es más rápido y, sobre todo, evita agotar el límite
 * de 3 intentos por 10 segundos de Better Auth, que está activo a propósito
 * también fuera de producción.
 *
 * El escenario 7 sí hace un login interactivo completo: lo que aquí se optimiza
 * es la preparación, no la prueba del propio login.
 */

const roles: Role[] = ["admin", "sales", "content"]

for (const role of roles) {
  setup(`sesión guardada para ${role}`, async ({ page }) => {
    await loginAs(page, role)

    // Comprobación mínima de que la sesión sirve: el panel responde y muestra
    // la navegación del rol. Se localiza por su nombre accesible porque la
    // página incluye también la navegación pública y la del pie.
    await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible()

    mkdirSync(dirname(STORAGE_STATE[role]), { recursive: true })
    await page.context().storageState({ path: STORAGE_STATE[role] })
  })
}
