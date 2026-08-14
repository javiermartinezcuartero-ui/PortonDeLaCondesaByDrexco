import { getAttribution } from "@/lib/attribution"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { NO_SPACE_PREFERENCE, splitFullName } from "@/lib/validation/lead-request"
import type { LeadRequestFormValues, LeadRequestResponse, SourceFormCode } from "@/lib/validation/lead-request"

/** Endpoint propio que sustituye al envío directo del navegador a Web3Forms. */
export const LEAD_REQUESTS_ENDPOINT = "/api/leads/requests"

export type SubmitLeadRequestContext = {
  sourceForm: SourceFormCode
  /** Ficha de la que viene el CTA ("Quiero una boda así"), si aplica. */
  sourceContentId?: string
  /** Clave de idempotencia del envío. Ver `newSubmissionId`. */
  submissionId: string
  /** Milisegundos desde que se pintó el formulario hasta el envío. */
  formElapsedMs: number
  /**
   * Asunto con el que se envía la solicitud cuando el formulario no lo trae.
   *
   * Lo calcula quien llama y no este módulo porque el asunto derivado es el tipo de
   * evento **en el idioma de la persona**, y las etiquetas traducidas viven en
   * `data/site-content*.ts`, que es capa de presentación: importarla desde aquí
   * invertiría las capas para obtener un texto que la pantalla ya tiene a mano.
   */
  fallbackSubject: string
}

/**
 * Clave de idempotencia por intento de envío. `randomUUID` existe en todos los
 * navegadores con contexto seguro (incluido localhost); el respaldo cubre
 * navegadores antiguos sin él y no necesita ser criptográfico: solo tiene que
 * distinguir dos envíos distintos.
 */
export function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Envía una solicitud comercial al endpoint propio.
 *
 * La atribución, la ruta de origen y la versión de la política se completan
 * aquí, para que el componente de interfaz no tenga que conocer el contrato del
 * endpoint.
 *
 * No lanza: cualquier fallo se devuelve como resultado, de modo que el
 * formulario pueda mostrar un estado de error y **conservar lo que la persona
 * escribió**.
 */
export async function submitLeadRequest(
  values: LeadRequestFormValues,
  context: SubmitLeadRequestContext
): Promise<LeadRequestResponse> {
  const attribution = getAttribution()

  const { fullName, ...rest } = values

  const body = {
    ...rest,
    // El formulario pide un solo campo de nombre; el endpoint y el CRM siguen
    // trabajando con nombre y apellidos separados. La traducción entre ambos ocurre
    // aquí y en ningún otro sitio.
    ...splitFullName(fullName),
    // El espacio preferido salió del formulario. Quien no lo pregunta declara «sin
    // preferencia», que es lo que significa: el endpoint sigue exigiendo un valor
    // válido y este lo es.
    preferredSpace: values.preferredSpace || NO_SPACE_PREFERENCE,
    // El asunto también salió del formulario. Si viene relleno es porque el CTA de
    // una ficha VIP lo puso («Quiero una boda así»), y ese texto describe la
    // solicitud mejor que nada que se pueda derivar; si no, se usa el tipo de evento.
    // El endpoint lo sigue exigiendo, y con razón: el panel lista las solicitudes por
    // su asunto.
    subject: values.subject || context.fallbackSubject,
    // El servidor exige una ruta interna; sin `window` (que no debería ocurrir
    // en un formulario) se envía la raíz.
    sourcePage: attribution.path ?? "/",
    sourceForm: context.sourceForm,
    sourceContentId: context.sourceContentId,
    referrer: attribution.referrer ?? undefined,
    utmSource: attribution.utmSource ?? undefined,
    utmMedium: attribution.utmMedium ?? undefined,
    utmCampaign: attribution.utmCampaign ?? undefined,
    utmContent: attribution.utmContent ?? undefined,
    utmTerm: attribution.utmTerm ?? undefined,
    policyVersion: PRIVACY_POLICY_VERSION,
    submissionId: context.submissionId,
    formElapsedMs: context.formElapsedMs,
  }

  try {
    const response = await fetch(LEAD_REQUESTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    return (await response.json()) as LeadRequestResponse
  } catch {
    // Sin red o con respuesta ilegible: el mensaje al visitante es el mismo que
    // si hubiera fallado la persistencia, porque para él es indistinguible.
    return { ok: false, code: "persistence-failed" }
  }
}
