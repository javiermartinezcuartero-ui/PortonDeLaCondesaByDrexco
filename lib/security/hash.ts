import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Hash HMAC-SHA256 irreversible con soporte de rotación de clave: firma
 * siempre con la clave "actual" (la primera de `secrets`), pero permite
 * verificar contra cualquiera de las claves configuradas (actual + anteriores)
 * durante la ventana de rotación, sin invalidar de golpe lo ya hasheado con
 * la clave previa.
 */
function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex")
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export type RotatableSecrets = { current: string; previous?: string[] }

export function hashWithRotation(value: string, secrets: RotatableSecrets): string {
  return hmac(secrets.current, value)
}

export function verifyWithRotation(value: string, hash: string, secrets: RotatableSecrets): boolean {
  return hashCandidatesWithRotation(value, secrets).some((candidate) => safeEqual(candidate, hash))
}

/** Todos los hashes posibles de `value` bajo la clave actual y las anteriores (para lookups indexados en BD). */
export function hashCandidatesWithRotation(value: string, secrets: RotatableSecrets): string[] {
  return [secrets.current, ...(secrets.previous ?? [])].map((secret) => hmac(secret, value))
}

function readSecrets(currentEnvVar: string, previousEnvVar: string): RotatableSecrets {
  const current = process.env[currentEnvVar]
  if (!current) {
    throw new Error(`${currentEnvVar} no está configurada`)
  }
  const previousRaw = process.env[previousEnvVar]
  const previous = previousRaw ? previousRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined
  return { current, previous }
}

/** Hash irreversible de un identificador (p. ej. IP) para rate limiting. Nunca se guarda la IP en claro. */
export function hashRateLimitKey(value: string): string {
  return hashWithRotation(value, readSecrets("RATE_LIMIT_HASH_SECRET", "RATE_LIMIT_HASH_SECRET_PREVIOUS"))
}

/** Hash irreversible de un token de acceso VIP. El token en claro nunca se persiste. */
export function hashVipToken(token: string): string {
  return hashWithRotation(token, readSecrets("VIP_TOKEN_HASH_SECRET", "VIP_TOKEN_HASH_SECRET_PREVIOUS"))
}

export function verifyVipToken(token: string, tokenHash: string): boolean {
  return verifyWithRotation(token, tokenHash, readSecrets("VIP_TOKEN_HASH_SECRET", "VIP_TOKEN_HASH_SECRET_PREVIOUS"))
}

/** Hashes candidatos (clave actual + anteriores) para buscar una sesión VIP por índice único `tokenHash`. */
export function vipTokenHashCandidates(token: string): string[] {
  return hashCandidatesWithRotation(token, readSecrets("VIP_TOKEN_HASH_SECRET", "VIP_TOKEN_HASH_SECRET_PREVIOUS"))
}
