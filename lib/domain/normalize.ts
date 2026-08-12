/** Normalización de identificadores de contacto para deduplicar Lead. */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Normaliza un teléfono a formato E.164 aproximado. Asume España (+34) para
 * números de 9 dígitos sin prefijo internacional, ya que el negocio solo
 * opera en Murcia — no es una normalización E.164 general.
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/[^\d]/g, "")

  if (hasPlus) return `+${digits}`
  if (digits.length === 9) return `+34${digits}`
  return digits
}
