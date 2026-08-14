import { EMAIL_TIMEOUT_MS, maskEmails } from "@/lib/email/config"
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/provider"

/**
 * Adaptador de Resend sobre su API HTTP (`POST /emails`).
 *
 * Sustituye al de SendGrid, que no llegó a poder usarse. El cambio no toca ni el
 * dominio ni la captación: para eso existía `EmailProvider`, y esta es la primera vez
 * que se cobra el interés de haberlo puesto.
 *
 * Se usa `fetch` y no el SDK oficial (`npm i resend`), por lo mismo que se decidió
 * con el proveedor anterior: el SDK arrastra dependencias que no hacen falta para una
 * única llamada HTTP, y en el runtime de Vercel cada dependencia pesa. Lo que se
 * necesita aquí es un POST con timeout.
 *
 * Clasificación del fallo, que es lo que decide el estado registrado:
 *
 * - **200** → `SENT`, con el `id` que devuelve Resend. Que lo acepte no significa que
 *   llegue a la bandeja, y el registro no promete más de lo que sabe.
 * - **429 y 5xx**, timeout o error de red → `RETRY_PENDING`. El mensaje era válido y
 *   el problema es del momento. **Nada lo reintenta automáticamente hoy** (ver
 *   docs/email.md §7); el estado sirve para saber qué habría que reintentar.
 * - **Resto de 4xx** → `FAILED`. Clave inválida, dominio del remitente sin verificar,
 *   payload rechazado: reintentar el mismo mensaje da el mismo resultado.
 *
 * Nada de esto registra la clave de API ni el cuerpo del mensaje.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend"

  private static readonly ENDPOINT = "https://api.resend.com/emails"

  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (message.to.length === 0) {
      return { status: "SKIPPED_CONFIG", reason: "sin destinatarios" }
    }

    const payload = {
      from: this.from,
      to: message.to,
      subject: message.subject,
      // Resend acepta las dos alternativas en el mismo envío y compone el multipart
      // por su cuenta, así que aquí no hay que ordenarlas como exigía SendGrid.
      html: message.html,
      text: message.text,
      // La API HTTP usa `reply_to` en snake_case; es el SDK el que expone `replyTo`.
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }

    let response: Response
    try {
      response = await fetch(ResendEmailProvider.ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        // Sin timeout, un proveedor lento mantendría viva la función serverless hasta
        // que la plataforma la corte, y sin registro de lo ocurrido.
        signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      })
    } catch (error) {
      const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
      return {
        status: "RETRY_PENDING",
        reason: isTimeout ? `timeout tras ${EMAIL_TIMEOUT_MS} ms` : "error de red",
      }
    }

    if (response.ok) {
      return {
        status: "SENT",
        providerMessageId: await readMessageId(response),
      }
    }

    if (response.status === 429 || response.status >= 500) {
      return { status: "RETRY_PENDING", reason: `proveedor respondió ${response.status}` }
    }

    // El cuerpo del error de Resend repite el remitente y los destinatarios, así que
    // no se copia: solo el código, que es lo que dice qué hacer.
    return { status: "FAILED", reason: `proveedor rechazó el envío (${response.status})` }
  }

  /** Descripción para el log, sin la clave. */
  describe(message: EmailMessage): Record<string, unknown> {
    return { destinatarios: maskEmails(message.to), asunto: message.subject }
  }
}

/**
 * Identificador del envío, si viene.
 *
 * Resend lo devuelve en el cuerpo (`{ "id": "..." }`) y no en una cabecera, así que
 * hay que leer el JSON. Va envuelto porque un cuerpo ilegible **no es un fallo de
 * envío**: el proveedor ya respondió 200 y el correo está aceptado. Sin esta guarda,
 * un cambio de formato en su respuesta convertiría un envío correcto en una excepción.
 */
async function readMessageId(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { id?: unknown }
    return typeof body.id === "string" ? body.id : undefined
  } catch {
    return undefined
  }
}
