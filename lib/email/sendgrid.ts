import { EMAIL_TIMEOUT_MS, maskEmails } from "@/lib/email/config"
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/provider"

/**
 * Adaptador de SendGrid sobre su API v3 (`POST /v3/mail/send`).
 *
 * Se usa `fetch` y no el SDK oficial a propósito: el SDK arrastra dependencias que
 * no hacen falta para una única llamada HTTP, y en el runtime de Vercel cada
 * dependencia pesa. Aquí lo único que se necesita es un POST con timeout.
 *
 * Clasificación del fallo, que es lo que decide el estado registrado:
 *
 * - **202** → `SENT`. SendGrid acepta y encola; no promete entrega en bandeja, y el
 *   registro tampoco lo hace.
 * - **429 y 5xx**, timeout o error de red → `RETRY_PENDING`. El mensaje era válido y
 *   el problema es del momento. **Nada lo reintenta automáticamente hoy**
 *   (ver docs/email.md §7); el estado sirve para saber qué habría que reintentar.
 * - **Resto de 4xx** → `FAILED`. Credenciales inválidas, remitente sin verificar,
 *   payload rechazado: reintentar el mismo mensaje da el mismo resultado.
 *
 * Nada de esto registra la clave de API ni el cuerpo del mensaje.
 */
export class SendGridEmailProvider implements EmailProvider {
  readonly name = "sendgrid"

  private static readonly ENDPOINT = "https://api.sendgrid.com/v3/mail/send"

  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (message.to.length === 0) {
      return { status: "SKIPPED_CONFIG", reason: "sin destinatarios" }
    }

    const payload = {
      personalizations: [{ to: message.to.map((address) => ({ email: address })) }],
      from: { email: this.from },
      ...(message.replyTo ? { reply_to: { email: message.replyTo } } : {}),
      subject: message.subject,
      content: [
        // El orden importa en SendGrid: el texto plano va primero y el HTML
        // después, porque el cliente de correo elige la última alternativa que
        // sabe pintar.
        { type: "text/plain", value: message.text },
        { type: "text/html", value: message.html },
      ],
    }

    let response: Response
    try {
      response = await fetch(SendGridEmailProvider.ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        // Sin timeout, un proveedor lento mantendría viva la función serverless
        // hasta que la plataforma la corte, y sin registro de lo ocurrido.
        signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      })
    } catch (error) {
      const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
      return {
        status: "RETRY_PENDING",
        reason: isTimeout ? `timeout tras ${EMAIL_TIMEOUT_MS} ms` : "error de red",
      }
    }

    if (response.status === 202) {
      return {
        status: "SENT",
        providerMessageId: response.headers.get("x-message-id") ?? undefined,
      }
    }

    if (response.status === 429 || response.status >= 500) {
      return { status: "RETRY_PENDING", reason: `proveedor respondió ${response.status}` }
    }

    // El cuerpo del error de SendGrid puede repetir las direcciones del envío, así
    // que no se copia: solo el código, que es lo que dice qué hacer.
    return { status: "FAILED", reason: `proveedor rechazó el envío (${response.status})` }
  }

  /** Descripción para el log, sin la clave. */
  describe(message: EmailMessage): Record<string, unknown> {
    return { destinatarios: maskEmails(message.to), asunto: message.subject }
  }
}
