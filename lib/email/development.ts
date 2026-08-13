import { maskEmails } from "@/lib/email/config"
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/provider"
import { logInfo } from "@/lib/observability/log"

/**
 * Adaptador para cuando no hay proveedor configurado: deja constancia en el
 * registro y no envía nada.
 *
 * Devuelve `SKIPPED_CONFIG`, no `SENT`. Es importante: si devolviera `SENT`, el
 * registro afirmaría que un correo salió cuando no salió, y esa mentira sería peor
 * que no tener correo. Aquí "entregar" es escribir una línea en el log.
 *
 * **No imprime el correo completo ni el asunto.** Ni el cuerpo, ni la dirección
 * entera, ni el asunto: el cuerpo de un aviso comercial contiene el mensaje que
 * escribió una persona, con su nombre y su teléfono, y **el asunto del aviso
 * interno se compone con el asunto que escribió el visitante**
 * (`lib/email/templates.ts`), que es texto libre. Un log se copia en incidencias,
 * se pega en chats y acaba en sitios que nadie previó.
 *
 * "Adaptador de desarrollo" es un nombre engañoso y conviene tenerlo presente:
 * `resolveEmailProvider` lo devuelve **siempre que falte `SENDGRID_API_KEY` o
 * `LEADS_FROM_EMAIL`**, incluido en producción, donde las dos son opcionales. Este
 * código escribe en el log de producción.
 *
 * Se registra a través de `logInfo`, no con `console.info`, precisamente por eso:
 * el registro estructurado descarta por nombre de clave cualquier campo que suene
 * a dato personal (`subject|asunto|message|nombre|phone|...`), así que un campo
 * añadido sin pensar en el futuro se omite en lugar de publicarse. Para revisar
 * cómo queda una plantilla están sus pruebas, que sí trabajan con el HTML completo
 * en memoria.
 */
export class DevelopmentEmailProvider implements EmailProvider {
  readonly name = "development"

  constructor(private readonly reason: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    logInfo("email.skipped_no_provider", {
      destinatarios: maskEmails(message.to),
      caracteresHtml: message.html.length,
      caracteresTexto: message.text.length,
      motivo: this.reason,
    })

    return { status: "SKIPPED_CONFIG", reason: this.reason }
  }
}
