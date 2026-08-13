import { randomUUID } from "node:crypto"

/**
 * Registro estructurado con identificador de petición.
 *
 * Dos problemas que resuelve:
 *
 * 1. **Correlación.** Sin un `requestId`, un error en producción es una línea suelta
 *    que no se puede unir con las demás de la misma petición. Con él, un aviso de
 *    "no se pudo guardar la solicitud" se cruza con la respuesta que vio el
 *    visitante.
 * 2. **Fugas.** El registro no acepta texto libre: recibe un objeto y lo pasa por un
 *    filtro que **descarta las claves con nombre de dato personal** y trunca las
 *    cadenas. Un `console.error("fallo con", payload)` es la forma más habitual de
 *    acabar con el mensaje y el teléfono de alguien en el log.
 *
 * El identificador se **acepta de la cabecera** cuando la plataforma ya la pone
 * (Vercel envía `x-vercel-id`), y si no se genera. Nunca se devuelve al cliente
 * salvo en respuestas de error, donde sirve para que alguien pueda decir "me falló
 * con este código" sin contar nada de sí mismo.
 */

/**
 * Claves cuyo **valor** nunca se registra. Es una lista de nombres, no de
 * contenidos: se filtra por cómo se llama el campo, que es lo que se puede
 * comprobar de forma fiable.
 */
const BLOCKED_KEYS =
  /email|mail|phone|tel|nombre|name|apellid|message|mensaje|nota|note|body|subject|asunto|token|password|contrase|secret|api[-_]?key|cookie|authorization|ip|user[-_]?agent|direccion|address/i

const MAX_VALUE_LENGTH = 200

export type LogFields = Record<string, unknown>

export type LogLevel = "info" | "warn" | "error"

/** Toma el identificador de la plataforma si existe; si no, genera uno. */
export function resolveRequestId(headers: Headers): string {
  const forwarded = headers.get("x-request-id") ?? headers.get("x-vercel-id")
  if (forwarded) return forwarded.slice(0, 100)
  return randomUUID()
}

/**
 * Filtra un objeto de campos para poder registrarlo.
 *
 * Las claves bloqueadas se sustituyen por `"[omitido]"` en lugar de desaparecer: así
 * el log dice que había un dato y que se decidió no guardarlo, que es más útil que
 * un hueco silencioso.
 */
export function sanitizeLogFields(fields: LogFields): LogFields {
  const safe: LogFields = {}

  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED_KEYS.test(key)) {
      safe[key] = "[omitido]"
      continue
    }
    if (value === null || value === undefined) continue
    if (typeof value === "string") {
      safe[key] = value.slice(0, MAX_VALUE_LENGTH)
      continue
    }
    if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value
      continue
    }
    if (value instanceof Date) {
      safe[key] = value.toISOString()
      continue
    }
    // Objetos y arrays no se serializan: es justo donde se cuelan los cuerpos
    // enteros de petición. Se registra solo su forma.
    safe[key] = Array.isArray(value) ? `[array:${value.length}]` : "[objeto]"
  }

  return safe
}

/**
 * Códigos de error **operativos**: los que aparecen en el log y, si hace falta, en
 * la respuesta. Son estables y no describen el fallo interno: `E_PERSISTENCE` no
 * dice qué tabla falló, pero permite buscar el patrón en los registros.
 */
export const ERROR_CODES = {
  validation: "E_VALIDATION",
  unauthenticated: "E_UNAUTHENTICATED",
  forbidden: "E_FORBIDDEN",
  rateLimited: "E_RATE_LIMITED",
  payloadTooLarge: "E_PAYLOAD_TOO_LARGE",
  persistence: "E_PERSISTENCE",
  email: "E_EMAIL",
  storage: "E_STORAGE",
  unexpected: "E_UNEXPECTED",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

function emit(level: LogLevel, event: string, fields: LogFields): void {
  const entry = { level, event, at: new Date().toISOString(), ...sanitizeLogFields(fields) }
  const line = JSON.stringify(entry)

  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.info(line)
}

export function logInfo(event: string, fields: LogFields = {}): void {
  emit("info", event, fields)
}

export function logWarn(event: string, fields: LogFields = {}): void {
  emit("warn", event, fields)
}

/**
 * Registra un error.
 *
 * **Nunca se registra el stack.** Un stack en producción revela rutas del sistema y
 * versiones de dependencias, y en un log agregado acaba siendo lo que más ruido y
 * más información filtra. Se guarda el código operativo, el mensaje recortado y el
 * `requestId`, que es lo que hace falta para encontrar el problema.
 */
export function logError(
  event: string,
  input: { code: ErrorCode; requestId?: string; error?: unknown } & LogFields
): void {
  const { code, requestId, error, ...rest } = input

  emit("error", event, {
    code,
    requestId,
    // Solo el mensaje, acotado. Ni stack ni objeto de error completo.
    reason: error instanceof Error ? error.message.slice(0, MAX_VALUE_LENGTH) : undefined,
    ...rest,
  })
}
