/**
 * Tratamiento de texto libre que llega de un formulario público.
 *
 * Criterio: **no se transforma el contenido al guardarlo**. Nadie reescribe el
 * mensaje de un visitante para "limpiarlo": si escribe `<script>` o comillas,
 * eso es exactamente lo que quiso escribir y es lo que debe leer el equipo
 * comercial. La defensa contra inyección va en la salida:
 *
 * - En la interfaz, React/JSX escapa cualquier cadena que se interpole, así que
 *   renderizar el mensaje es seguro sin hacer nada.
 * - En cualquier salida que **no** sea JSX (cuerpo HTML de un email, exportación
 *   a CSV, cabeceras), hay que escapar explícitamente con `escapeHtml`.
 * - Las consultas van siempre por Prisma con parámetros; no se concatena SQL.
 *
 * La única limpieza que se aplica antes de persistir es la de caracteres de
 * control, y por una razón técnica concreta, no estética: PostgreSQL rechaza el
 * byte NUL en columnas de texto, así que un NUL colado en el mensaje tumbaría la
 * transacción entera. Se conservan tabulador, salto de línea y retorno de carro,
 * que sí son parte del texto que escribió la persona.
 */

const TAB = 9
const LINE_FEED = 10
const CARRIAGE_RETURN = 13
const FIRST_PRINTABLE = 32
const DELETE = 127
const LAST_C1 = 159

function isControlCharacter(codePoint: number): boolean {
  if (codePoint === TAB || codePoint === LINE_FEED || codePoint === CARRIAGE_RETURN) return false
  // C0 por debajo del espacio, y C1 desde DEL hasta 0x9F.
  return codePoint < FIRST_PRINTABLE || (codePoint >= DELETE && codePoint <= LAST_C1)
}

export function stripControlCharacters(value: string): string
export function stripControlCharacters(value: string | undefined): string | undefined
export function stripControlCharacters(value: string | undefined): string | undefined {
  if (value === undefined) return undefined

  let cleaned = ""
  // Se recorre por code points (no por unidades UTF-16) para no partir emojis
  // ni caracteres fuera del plano básico.
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && isControlCharacter(codePoint)) continue
    cleaned += character
  }
  return cleaned
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/**
 * Escapa una cadena para interpolarla en HTML fuera de JSX. Se usa en el cuerpo
 * de las notificaciones (ver lib/notifications/lead-request-notification.ts).
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character)
}
