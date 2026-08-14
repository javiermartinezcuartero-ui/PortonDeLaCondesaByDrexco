/**
 * Contrato del envío de correo.
 *
 * La aplicación habla con esta interfaz y nunca con Resend directamente. Eso es
 * lo que permite que la base de datos siga siendo la fuente de verdad: cambiar de
 * proveedor, o quedarse sin ninguno, no toca ni el dominio ni la captación.
 *
 * Dos reglas del contrato:
 *
 * 1. **`send` no lanza.** Devuelve siempre un resultado, incluido el fallo. Un
 *    proveedor que lanzara obligaría a cada llamante a envolverlo en un
 *    `try/catch`, y el día que alguien lo olvidara un correo caído se llevaría por
 *    delante una operación que ya estaba guardada. (Las capas de notificación
 *    ponen su propio `try/catch` de todas formas, por si un adaptador futuro
 *    incumple esto.)
 * 2. **Los estados del resultado son los de `NotificationLog`**, uno a uno. Así no
 *    hay traducción intermedia donde perder matices: lo que decide el adaptador es
 *    exactamente lo que queda registrado.
 */

export type EmailMessage = {
  to: string[]
  subject: string
  /** Cuerpo HTML. Debe llevar todo el texto libre ya escapado. */
  html: string
  /** Alternativa en texto plano. Obligatoria: no todos los clientes pintan HTML. */
  text: string
  /** Dirección de respuesta, cuando conviene que sea distinta del remitente. */
  replyTo?: string
}

export type EmailSendResult =
  /** El proveedor aceptó el mensaje. No garantiza que llegue a la bandeja. */
  | { status: "SENT"; providerMessageId?: string }
  /** Fallo permanente: reintentar con el mismo mensaje daría el mismo resultado. */
  | { status: "FAILED"; reason: string }
  /** Fallo transitorio: merecería reintento. Ver docs/email.md §7. */
  | { status: "RETRY_PENDING"; reason: string }
  /** No se intentó porque falta configuración. No es un error. */
  | { status: "SKIPPED_CONFIG"; reason: string }

export interface EmailProvider {
  /** Identificador corto para el registro ("resend", "development"). */
  readonly name: string
  send(message: EmailMessage): Promise<EmailSendResult>
}

/** Contenido de un correo, antes de saber a quién se envía. */
export type EmailContent = {
  subject: string
  html: string
  text: string
}
