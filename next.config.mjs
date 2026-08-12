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

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: supabaseImagePattern(),
  },
}

export default nextConfig
