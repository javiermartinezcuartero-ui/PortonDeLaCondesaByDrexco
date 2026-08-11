export type VipGateKey = "bodas-reales" | "catering"

function storageKey(key: VipGateKey) {
  return `porton-vip-access-${key}`
}

export function hasVipAccess(key: VipGateKey): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(storageKey(key)) !== null
}

export function grantVipAccess(key: VipGateKey, email: string) {
  window.localStorage.setItem(storageKey(key), email)
}

/**
 * Envía el email de acceso VIP por el mismo canal que el formulario de
 * contacto (Web3Forms), a la espera de un backend propio que almacene y
 * gestione estos leads (ver TODO en lib/leads.ts).
 */
export async function submitVipEmail(key: VipGateKey, email: string): Promise<{ ok: boolean }> {
  const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_KEY
  if (!accessKey) {
    console.warn("[vip-access] NEXT_PUBLIC_WEB3FORMS_KEY no configurada, email no enviado:", email)
    return { ok: false }
  }

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `Nuevo acceso VIP — ${key === "bodas-reales" ? "Bodas reales" : "Catering"}`,
        from_name: "Biblioteca VIP — El Portón de la Condesa",
        email,
        section: key,
        landing_url: typeof window !== "undefined" ? window.location.href : "",
      }),
    })
    const data = await response.json()
    return { ok: Boolean(response.ok && data.success) }
  } catch (error) {
    console.error("[vip-access] error de red al registrar el email:", error)
    return { ok: false }
  }
}
