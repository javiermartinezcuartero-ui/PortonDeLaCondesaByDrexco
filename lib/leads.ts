import { getAttribution } from "@/lib/attribution"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
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

  const body = {
    ...values,
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
