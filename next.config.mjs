/**
 * Host del proyecto de Supabase, derivado de SUPABASE_URL en vez de estar
 * escrito a mano: así un cambio de proyecto (o un entorno distinto) no obliga
 * a tocar esta configuración ni deja autorizado un host que ya no se usa.
 */
function supabaseImagePattern() {
  const raw = process.env.SUPABASE_URL
  if (!raw) return []

  try {
    const { protocol, hostname } = new URL(raw)
    if (protocol !== "https:") return []

    return [
      {
        protocol: "https",
        hostname,
        // Solo la ruta de objetos firmados del bucket privado. No se autoriza
        // todo el host: un `/**` permitiría proxyar cualquier archivo del
        // proyecto de Supabase a través del optimizador de imágenes.
        pathname: "/storage/v1/object/sign/**",
      },
    ]
  } catch {
    return []
  }
}

/**
 * Cabeceras de seguridad.
 *
 * La lista y la CSP viven en `lib/security/headers.ts`, no aquí, para que se
 * puedan probar: una CSP escrita en la configuración es un sitio donde nadie mira
 * hasta que algo se rompe en producción. Este archivo solo las conecta.
 *
 * Se importa con `await import()` porque `next.config.mjs` es un módulo ESM y el
 * archivo de cabeceras es TypeScript: Next compila la configuración, así que la
 * importación dinámica es la vía que funciona en los dos momentos (build y dev).
 */
async function headers() {
  const { securityHeaders } = await import("./lib/security/headers.ts")

  return [
    {
      // Todas las rutas, incluidas las de API y los archivos estáticos servidos
      // por Next.
      source: "/:path*",
      headers: securityHeaders(),
    },
  ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: supabaseImagePattern(),
  },
  headers,
  // No se expone la versión de Next en las respuestas: es información que solo
  // sirve a quien busca una vulnerabilidad conocida de esa versión concreta.
  poweredByHeader: false,
}

export default nextConfig
