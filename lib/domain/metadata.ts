/**
 * Saneador de `metadata` para LeadActivity/AuditEvent: evita que se persistan
 * contraseñas, tokens, cabeceras de autorización, IP/user-agent completos o
 * cuerpos enteros de petición con PII. Se aplica siempre antes de escribir en
 * base de datos (ver lib/domain/activities.ts y lib/domain/audit.ts).
 */

const BLOCKED_KEY_PATTERN =
  /password|secret|token|authorization|cookie|api[-_]?key|ip[-_]?address|user[-_]?agent|ssn|iban|card[-_]?number/i

const MAX_STRING_LENGTH = 500
const MAX_DEPTH = 3

export type SafeMetadata = Record<string, unknown>

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return undefined
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1))
  }
  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) return undefined
    return sanitizeMetadata(value as Record<string, unknown>, depth + 1)
  }
  return undefined
}

export function sanitizeMetadata(input: Record<string, unknown> | null | undefined, depth = 0): SafeMetadata {
  if (!input) return {}
  const safe: SafeMetadata = {}
  for (const [key, value] of Object.entries(input)) {
    if (BLOCKED_KEY_PATTERN.test(key)) continue
    const sanitized = sanitizeValue(value, depth)
    if (sanitized !== undefined) safe[key] = sanitized
  }
  return safe
}
