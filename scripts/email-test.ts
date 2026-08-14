/**
 * Comprueba que el correo transaccional está bien configurado y envía un mensaje real.
 *
 * `npm run email:test`
 *
 * Existe porque «los correos no llegan» tiene cuatro causas posibles —falta la clave,
 * falta el remitente, falta el buzón de destino, o el proveedor rechaza el envío— y
 * desde el formulario no se distinguen: la solicitud se guarda igual y el visitante ve
 * su confirmación, porque la base de datos es la fuente de verdad y el correo un efecto
 * secundario. Este script separa las cuatro en un solo comando.
 *
 * Usa el **adaptador del proyecto**, no la API de Resend directamente. Es la diferencia
 * entre comprobar que Resend funciona y comprobar que esta aplicación envía: aquí se
 * ejercita la lectura de configuración, la resolución del proveedor y la clasificación
 * del resultado, que es donde puede estar el fallo.
 *
 * No escribe la clave en ningún sitio: de ella solo informa la longitud y el prefijo.
 */
import { hasTransport, maskEmails, readEmailConfig } from "../lib/email/config"
import { ResendEmailProvider } from "../lib/email/resend"

async function main() {
  const config = readEmailConfig()

  console.log("Configuración leída del entorno:")
  console.log(
    "  RESEND_API_KEY:",
    config.apiKey ? `presente (${config.apiKey.slice(0, 3)}…, ${config.apiKey.length} caracteres)` : "AUSENTE"
  )
  console.log("  LEADS_FROM_EMAIL:", config.from ?? "AUSENTE")
  console.log(
    "  LEADS_NOTIFICATION_TO:",
    config.notificationTo.length > 0 ? maskEmails(config.notificationTo) : "AUSENTE"
  )
  console.log("  SEND_LEAD_ACKNOWLEDGEMENT:", config.sendAcknowledgement ? "activado" : "desactivado")
  console.log("  Transporte real disponible:", hasTransport(config) ? "sí" : "no")
  console.log("")

  const missing = [
    !config.apiKey ? "RESEND_API_KEY" : null,
    !config.from ? "LEADS_FROM_EMAIL" : null,
    config.notificationTo.length === 0 ? "LEADS_NOTIFICATION_TO" : null,
  ].filter((name): name is string => name !== null)

  if (missing.length > 0) {
    console.error(`No se intenta el envío: falta ${missing.join(", ")}.`)
    console.error("Sin esas variables la web funciona igual, pero no sale ningún correo.")
    process.exit(1)
  }

  const provider = new ResendEmailProvider(config.apiKey!, config.from!)
  const result = await provider.send({
    to: config.notificationTo,
    subject: "El Portón de la Condesa — prueba de envío",
    text: [
      "Prueba de la integración de correo transaccional.",
      "",
      "Si lees esto, el aviso interno de cada solicitud nueva del formulario llegará a este buzón.",
      "Enviado con el adaptador del proyecto (lib/email/resend.ts).",
    ].join("\n"),
    html: [
      '<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a1a">',
      '<h2 style="margin:0 0 12px">Prueba de envío correcta</h2>',
      "<p>Integración de correo transaccional con <strong>Resend</strong>.</p>",
      "<p>Si lees esto, el aviso interno de cada solicitud nueva del formulario llegará a este buzón.</p>",
      '<p style="color:#666;font-size:13px;margin-top:20px">Enviado con el adaptador del proyecto ',
      "(<code>lib/email/resend.ts</code>).</p>",
      "</div>",
    ].join(""),
  })

  console.log("Resultado:", JSON.stringify(result))
  console.log("")

  if (result.status === "SENT") {
    console.log("El proveedor aceptó el mensaje.")
    // La distinción no es una formalidad: un correo aceptado puede acabar en spam, o
    // rebotar después. El único sitio donde se ve la entrega es el panel del proveedor.
    console.log("Aceptar no es entregar: confírmalo en la bandeja y en el panel de Resend (Emails).")
    return
  }

  console.error(`El envío no salió (${result.status}).`)
  console.error(`Motivo: ${result.reason}`)
  console.error("")
  console.error("Las causas habituales, en orden de frecuencia:")
  console.error("  - El remitente no pertenece a un dominio verificado en Resend.")
  console.error("  - Con onboarding@resend.dev solo se puede escribir al titular de la cuenta.")
  console.error("  - La clave se revocó o pertenece a otra cuenta.")
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
