export type LeadAttribution = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  landingUrl: string | null
  referrer: string | null
}

/**
 * Lee UTMs de la URL actual y el referrer del navegador. Se ejecuta solo en
 * cliente porque depende de `window`/`document`.
 */
export function getAttribution(): LeadAttribution {
  if (typeof window === "undefined") {
    return {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      landingUrl: null,
      referrer: null,
    }
  }

  const params = new URLSearchParams(window.location.search)

  return {
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    landingUrl: window.location.href,
    referrer: document.referrer || null,
  }
}
