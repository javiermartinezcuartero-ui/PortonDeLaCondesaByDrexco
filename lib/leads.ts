import type { LeadAttribution } from "@/lib/attribution"

export type LeadFormPayload = {
  firstName: string
  lastName: string
  email: string
  phone: string
  eventType: string
  eventDate: string
  guestCount: string
  message?: string
  privacyConsent: boolean
  marketingConsent?: boolean
  attribution: LeadAttribution
}

export type SubmitLeadResult = {
  ok: boolean
  reason?: "not-configured" | "error"
}

/**
 * Envío del formulario de leads a través de Web3Forms (https://web3forms.com):
 * un servicio que reenvía la sumisión por email sin necesidad de backend ni
 * credenciales SMTP propias. Requiere una access key gratuita vinculada al
 * email de destino, configurada en `NEXT_PUBLIC_WEB3FORMS_KEY`.
 *
 * TODO(leads-api): cuando exista un backend propio (ver
 * project-reference/docs/03-arquitectura-crm-leads.md), sustituir esta llamada
 * por `POST /api/leads` con validación en servidor, rate limit, honeypot,
 * deduplicación por email y persistencia en el CRM.
 */
export async function submitLead(payload: LeadFormPayload): Promise<SubmitLeadResult> {
  const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_KEY

  if (!accessKey) {
    console.warn(
      "[leads] NEXT_PUBLIC_WEB3FORMS_KEY no configurada: el formulario no puede enviarse todavía.",
      payload
    )
    return { ok: false, reason: "not-configured" }
  }

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `Nueva solicitud — ${payload.eventType} — El Portón de la Condesa`,
        from_name: `${payload.firstName} ${payload.lastName}`,
        email: payload.email,
        phone: payload.phone,
        event_type: payload.eventType,
        event_date: payload.eventDate,
        guest_count: payload.guestCount,
        message: payload.message || "(sin mensaje)",
        marketing_consent: payload.marketingConsent ? "sí" : "no",
        utm_source: payload.attribution.utmSource ?? "",
        utm_medium: payload.attribution.utmMedium ?? "",
        utm_campaign: payload.attribution.utmCampaign ?? "",
        utm_content: payload.attribution.utmContent ?? "",
        landing_url: payload.attribution.landingUrl ?? "",
        referrer: payload.attribution.referrer ?? "",
      }),
    })

    const data = await response.json()
    if (!response.ok || !data.success) {
      console.error("[leads] Web3Forms rechazó el envío:", data)
      return { ok: false, reason: "error" }
    }

    return { ok: true }
  } catch (error) {
    console.error("[leads] error de red al enviar el formulario:", error)
    return { ok: false, reason: "error" }
  }
}
