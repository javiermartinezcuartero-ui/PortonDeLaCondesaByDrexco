/**
 * Configuración del correo transaccional, leída de entorno en cada llamada (no
 * en una constante de módulo) para que un cambio de variables no exija reiniciar
 * y para que los tests puedan alternar escenarios.
 *
 * Ninguna variable lleva prefijo `NEXT_PUBLIC_` salvo `NEXT_PUBLIC_SITE_URL`, que
 * es una URL pública por definición. La clave de API **nunca** sale de servidor ni
 * aparece en un log.
 */

export type EmailConfig = {
  apiKey: string | undefined
  /** Remitente verificado en el proveedor. */
  from: string | undefined
  /** Destinatarios internos del aviso comercial. */
  notificationTo: string[]
  /** Si el acuse al visitante está activado. Desactivado si la variable falta. */
  sendAcknowledgement: boolean
  /** Base para los enlaces al panel. Sin barra final. */
  siteUrl: string
}

/** Tiempo máximo de espera al proveedor. Un correo no puede colgar una petición. */
export const EMAIL_TIMEOUT_MS = 10_000

const DEFAULT_SITE_URL = "http://localhost:3000"

export function readEmailConfig(): EmailConfig {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() || undefined,
    from: process.env.LEADS_FROM_EMAIL?.trim() || undefined,
    notificationTo: parseRecipients(process.env.LEADS_NOTIFICATION_TO),
    // Solo `"true"` activa el acuse. Cualquier otro valor —o la variable ausente—
    // lo deja apagado: enviar correo a un visitante es una decisión que hay que
    // tomar explícitamente, no algo que se herede de un valor mal escrito.
    sendAcknowledgement: process.env.SEND_LEAD_ACKNOWLEDGEMENT?.trim() === "true",
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, ""),
  }
}

/** Lista separada por comas. Se descartan los huecos y los duplicados. */
function parseRecipients(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const value of raw.split(",")) {
    const trimmed = value.trim()
    if (trimmed) seen.add(trimmed)
  }
  return [...seen]
}

/**
 * ¿Hay transporte real disponible? Hacen falta clave y remitente: sin un remitente
 * de dominio verificado Resend rechaza el envío, así que tener solo la clave no sirve.
 */
export function hasTransport(config: EmailConfig = readEmailConfig()): boolean {
  return Boolean(config.apiKey && config.from)
}

/**
 * Oculta parcialmente una dirección para poder registrarla.
 *
 * Se conserva el dominio y la primera letra: es lo que permite diagnosticar
 * ("se intentó a un @gmail.com, no al buzón interno") sin guardar a quién se
 * escribió. Con una parte local de uno o dos caracteres no queda nada que
 * revelar, así que se enmascara entera.
 */
export function maskEmail(address: string): string {
  const trimmed = address.trim()
  const at = trimmed.lastIndexOf("@")
  if (at <= 0) return "***"

  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  if (!domain) return "***"

  const maskedLocal = local.length <= 2 ? "***" : `${local[0]}***${local[local.length - 1]}`
  return `${maskedLocal}@${domain}`
}

export function maskEmails(addresses: string[]): string {
  return addresses.map(maskEmail).join(", ")
}
