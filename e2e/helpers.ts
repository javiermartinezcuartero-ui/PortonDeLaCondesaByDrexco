import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test"
import { ACCOUNTS, type Role } from "./accounts"

/**
 * Utilidades compartidas por los escenarios. Todas actúan **por la interfaz**:
 * ninguna inyecta cookies ni escribe en la base para llegar antes a un estado.
 */

/**
 * Espera del límite de intentos de login.
 *
 * Better Auth limita `/sign-in/email` a 3 peticiones por 10 segundos y ese
 * límite está activo también fuera de producción a propósito (lib/auth.ts). La
 * suite inicia sesión con tres roles distintos, así que el límite se alcanza sin
 * que nada esté mal. Se espera un poco más de la ventana para no quedarse en el
 * borde.
 */
const RATE_LIMIT_WINDOW_MS = 11_000

/**
 * Inicia sesión rellenando el formulario real.
 *
 * El mensaje de error del login es genérico a propósito (no distingue email
 * inexistente de contraseña incorrecta ni de límite alcanzado), así que aquí no
 * se puede saber por qué ha fallado. Como las credenciales son correctas por
 * construcción —las crea `scripts/e2e-seed.ts`—, un fallo solo puede ser el
 * límite de intentos, y se reintenta tras esperar la ventana.
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const account = ACCOUNTS[role]

  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto("/admin/login")
    await page.locator("#email").fill(account.email)
    await page.locator("#password").fill(account.password)
    await page.getByRole("button", { name: "Entrar" }).click()

    const landed = await page
      .waitForURL((url) => url.pathname === "/admin", { timeout: 15_000 })
      .then(() => true)
      .catch(() => false)

    if (landed) return

    // `uiAlert` y no `getByRole("alert")`: el anunciador de rutas de Next
    // siempre está presente, así que contarlo daría "hay error" en todos los
    // casos y el reintento se dispararía siempre.
    if ((await uiAlert(page).count()) && attempt < 3) {
      await page.waitForTimeout(RATE_LIMIT_WINDOW_MS)
      continue
    }

    // Sin mensaje de error y sin haber navegado: algo distinto va mal. Se deja
    // que la aserción falle con el estado real a la vista.
    await expect(page).toHaveURL(/\/admin$/)
    return
  }

  throw new Error(
    `No se ha podido iniciar sesión como ${role} tras 3 intentos. ` +
      "Si el motivo es el límite de intentos, ejecuta la suite completa en vez de una prueba sola."
  )
}

/**
 * Abre un navegador nuevo para un visitante distinto, con su propia IP.
 *
 * **La IP importa.** El gate VIP limita a 5 accesos por IP cada 10 minutos
 * (`GATE_RATE_LIMIT` en lib/vip/gate-action.ts), y en un servidor local sin proxy
 * todas las peticiones comparten el mismo identificador. La suite pasa por el
 * gate más de cinco veces, así que las últimas pruebas recibían "demasiados
 * intentos" y fallaban **por culpa de las anteriores**: un acoplamiento que además
 * dependía del orden de ejecución. Dar a cada visitante su propia
 * `x-forwarded-for` es lo que ocurre en la realidad —son personas distintas— y no
 * relaja el límite: que un mismo visitante solo pueda intentarlo cinco veces se
 * comprueba en `lib/security/attack-surface.test.ts`.
 *
 * Las direcciones salen de 198.18.0.0/15, el rango reservado para pruebas de
 * rendimiento (RFC 2544): no es de nadie.
 */
export async function newVisitor(
  browser: Browser,
  lastOctet: number
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `198.18.0.${lastOctet}` },
  })
  return { context, page: await context.newPage() }
}

/**
 * Desbloquea el acceso VIP rellenando el gate.
 *
 * `returnPath` es la biblioteca por la que se entra. Al aceptar, el servidor
 * pone la cookie `HttpOnly` y la página se refresca sola.
 */
export async function unlockVipGate(page: Page, email: string, path = "/bodas-reales"): Promise<void> {
  await page.goto(path)
  await page.locator("#vip-email").fill(email)
  await privacyCheckbox(page).click()
  await page.getByRole("button", { name: "Acceder" }).click()

  const error = uiAlert(page)
  const gateHeading = page.getByRole("heading", { name: /Accede a la biblioteca/i })

  // Se espera a que pase una de las dos cosas: el gate se abre (su título
  // desaparece porque el servidor ya validó la sesión) o aparece un mensaje de
  // error. Si es lo segundo, el fallo dice **cuál** fue el error en vez de agotar
  // un tiempo de espera: "demasiados intentos" y "el formulario no responde" son
  // problemas distintos y conviene poder distinguirlos de un vistazo.
  await expect
    .poll(
      async () => {
        if (await error.count()) return (await error.innerText()).trim()
        return (await gateHeading.count()) ? "el gate sigue cerrado" : "acceso concedido"
      },
      { timeout: 20_000 }
    )
    .toBe("acceso concedido")
}

/**
 * Casillas de consentimiento, localizadas por su nombre accesible.
 *
 * **No por posición**: la primera casilla de la página no es la de privacidad,
 * es el conmutador de idioma de la cabecera. Localizar por nombre además
 * comprueba de paso que la etiqueta llega al árbol de accesibilidad, que es lo
 * que necesita quien navega con lector de pantalla.
 *
 * El texto de marketing cambia entre el gate ("Quiero recibir novedades…") y el
 * formulario de contacto ("Acepto recibir comunicaciones comerciales…"); el
 * patrón cubre los dos.
 */
export function privacyCheckbox(page: Page) {
  return page.getByRole("checkbox", { name: /acepto la política de privacidad/i })
}

export function marketingCheckbox(page: Page) {
  return page.getByRole("checkbox", { name: /comunicaciones comerciales|recibir novedades/i })
}

/**
 * Mensajes de error de la interfaz.
 *
 * Next inyecta en cada página un `<div role="alert" id="__next-route-announcer__">`
 * para anunciar los cambios de ruta a los lectores de pantalla. No es un mensaje
 * de la aplicación, así que se excluye: si no, cualquier `getByRole("alert")`
 * choca contra él en modo estricto.
 */
export function uiAlert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)')
}

/**
 * Elige una opción de un desplegable de Radix por la etiqueta del campo.
 *
 * Los `Select` de shadcn reciben el `id` que genera `FormControl`, y su
 * `FormLabel` lo apunta con `htmlFor`, así que `getByLabel` da con el disparador
 * sin depender del orden en que estén los campos en la página.
 */
export async function chooseOption(page: Page, fieldLabel: string, optionName: string | RegExp): Promise<void> {
  await page.getByLabel(fieldLabel).click()
  await page.getByRole("option", { name: optionName }).click()
}

/** Email ficticio distinto en cada ejecución, para no arrastrar estado. */
export function uniqueEmail(prefix: string): string {
  // `.test` es un TLD reservado (RFC 2606): no resuelve, así que ninguna prueba
  // puede escribir a una dirección real ni por accidente.
  return `${prefix}.${Date.now().toString(36)}@ejemplo.test`
}
