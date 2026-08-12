/**
 * Validación de URLs externas (vídeos y Reels de la ficha).
 *
 * El servidor nunca descarga estas URLs, pero aun así se validan de forma
 * estricta por dos motivos:
 *  1. **Anti-SSRF**: si en el futuro alguna parte del sistema las procesara
 *     (generar miniatura, comprobar disponibilidad, oEmbed), una URL apuntando
 *     a `169.254.169.254` o a `localhost` podría alcanzar servicios internos.
 *     Se bloquea aquí, en el punto de entrada, no cuando se use.
 *  2. **Anti-XSS**: `javascript:`, `data:` y `vbscript:` en un href/src
 *     ejecutan código en el navegador del visitante.
 */

const ALLOWED_PROTOCOLS = new Set(["https:"])

/** Hosts de vídeo aceptados. Lista explícita: es más seguro que intentar
 *  validar "cualquier host que parezca de vídeo". */
const ALLOWED_VIDEO_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "instagram.com",
  "www.instagram.com",
])

export class InvalidExternalUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidExternalUrlError"
  }
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return true
  }

  // IPv6 loopback y direcciones link-local/únicas locales.
  if (host === "::1" || host === "::" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true
  }

  // IPv4 (incluido el formato "::ffff:10.0.0.1" que también empieza por dígitos
  // tras el prefijo, cubierto por el bloque IPv6 de arriba).
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false

  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
  if (a === 127 || a === 0 || a === 10) return true // loopback, "this host", privada
  if (a === 169 && b === 254) return true // link-local (metadatos de cloud)
  if (a === 172 && b >= 16 && b <= 31) return true // privada
  if (a === 192 && b === 168) return true // privada
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast y reservadas

  return false
}

/**
 * Valida una URL externa y devuelve su forma normalizada.
 * @param options.allowedHosts si se indica, el host debe estar en la lista.
 */
export function validateExternalUrl(
  rawUrl: string,
  options: { allowedHosts?: ReadonlySet<string> } = {}
): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) throw new InvalidExternalUrlError("La URL está vacía.")

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new InvalidExternalUrlError("La URL no tiene un formato válido.")
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new InvalidExternalUrlError("Solo se aceptan URLs https://.")
  }

  if (url.username || url.password) {
    throw new InvalidExternalUrlError("La URL no puede incluir credenciales.")
  }

  if (isPrivateOrLoopbackHost(url.hostname)) {
    throw new InvalidExternalUrlError("La URL apunta a una dirección interna o privada.")
  }

  if (options.allowedHosts && !options.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new InvalidExternalUrlError(
      `Host no permitido. Se aceptan: ${[...options.allowedHosts].sort().join(", ")}.`
    )
  }

  return url.toString()
}

/** Valida la URL de un vídeo/Reel externo contra la lista de hosts admitidos. */
export function validateVideoUrl(rawUrl: string): string {
  return validateExternalUrl(rawUrl, { allowedHosts: ALLOWED_VIDEO_HOSTS })
}

export { ALLOWED_VIDEO_HOSTS }
