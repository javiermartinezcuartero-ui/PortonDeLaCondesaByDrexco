/**
 * Modo de visualización del panel privado: día (claro) o noche (oscuro).
 *
 * Vive en una cookie y no en `localStorage` por una razón concreta: el layout del
 * panel se renderiza en el servidor, así que puede leer la cookie y pintar
 * directamente el modo correcto. Con `localStorage` el servidor no sabe nada, el
 * primer HTML sale siempre en un modo y el cliente lo corrige después de hidratar
 * —el parpadeo blanco/oscuro clásico—, que además obligaría a meter un script
 * inline en el `<head>` y a abrirle un hueco a la CSP.
 *
 * Es **cookie de sesión de navegador**, sin `max-age` ni `expires`: se olvida al
 * cerrar el navegador. Y `enterAdminArea` la borra al entrar, así que cada acceso
 * empieza en día, como se pidió. Cambiar de modo se recuerda mientras se navega
 * por el panel, que es lo que espera cualquiera al pulsar el botón.
 */

export const ADMIN_THEME_COOKIE = "porton_admin_tema"

/** La ruta importa: así la cookie no viaja en las peticiones del sitio público. */
export const ADMIN_THEME_COOKIE_PATH = "/admin"

export type AdminTheme = "dia" | "noche"

/** Al acceder, el panel arranca en claro. */
export const DEFAULT_ADMIN_THEME: AdminTheme = "dia"

/**
 * Cualquier valor que no sea exactamente `noche` cae en el modo por omisión. Es
 * un valor que viene del cliente y puede ser cualquier cosa; no se confía en él
 * más allá de esta comparación.
 */
export function normalizeAdminTheme(value: string | undefined | null): AdminTheme {
  return value === "noche" ? "noche" : DEFAULT_ADMIN_THEME
}
