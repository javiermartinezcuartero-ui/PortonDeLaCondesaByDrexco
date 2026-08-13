import "server-only"

import { hasTransport, readEmailConfig, type EmailConfig } from "@/lib/email/config"
import { DevelopmentEmailProvider } from "@/lib/email/development"
import { SendGridEmailProvider } from "@/lib/email/sendgrid"
import type { EmailProvider } from "@/lib/email/provider"

/**
 * Elige el adaptador según la configuración presente.
 *
 * `import "server-only"` hace que el build falle si alguien importa esto desde un
 * componente cliente: la clave de API no puede acabar en el paquete del navegador.
 *
 * No hay una tercera vía. Con clave y remitente se usa SendGrid; sin ellos, el
 * adaptador de desarrollo, que registra y no envía. Un modo intermedio ("simular
 * envío") solo serviría para confundir el registro.
 */
export function resolveEmailProvider(config: EmailConfig = readEmailConfig()): EmailProvider {
  if (hasTransport(config) && config.apiKey && config.from) {
    return new SendGridEmailProvider(config.apiKey, config.from)
  }

  const missing = [
    !config.apiKey ? "SENDGRID_API_KEY" : null,
    !config.from ? "LEADS_FROM_EMAIL" : null,
  ].filter((name): name is string => name !== null)

  return new DevelopmentEmailProvider(`faltan ${missing.join(" y ")}`)
}

export { readEmailConfig, hasTransport, maskEmail, maskEmails, EMAIL_TIMEOUT_MS } from "@/lib/email/config"
export type { EmailConfig } from "@/lib/email/config"
export type { EmailContent, EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/provider"
