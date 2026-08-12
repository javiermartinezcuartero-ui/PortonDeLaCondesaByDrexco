export type LeadAttribution = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  /** Ruta interna desde la que se envía (sin dominio, sin query). */
  path: string | null
  referrer: string | null
}

const EMPTY_ATTRIBUTION: LeadAttribution = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  path: null,
  referrer: null,
}

/**
 * Lee UTMs de la URL actual y el referrer del navegador. Se ejecuta solo en
 * cliente porque depende de `window`/`document`.
 *
 * Se guarda la **ruta**, no la URL completa: el dominio ya lo conocemos y la
 * query puede arrastrar parámetros ajenos que no queremos persistir. El primer
 * origen (first touch) no se deduce de aquí: lo conserva `Lead.firstSource`, que
 * solo se escribe al crear el Lead (ver lib/domain/leads.ts).
 */
export function getAttribution(): LeadAttribution {
  if (typeof window === "undefined") return EMPTY_ATTRIBUTION

  const params = new URLSearchParams(window.location.search)

  return {
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    utmTerm: params.get("utm_term"),
    path: window.location.pathname,
    referrer: document.referrer || null,
  }
}
