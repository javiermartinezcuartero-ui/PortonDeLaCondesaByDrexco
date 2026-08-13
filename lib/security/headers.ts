/**
 * Cabeceras de seguridad de la aplicación.
 *
 * Vive en `lib/` y no dentro de `next.config.mjs` para poder probarlo: una CSP
 * escrita a mano en la configuración es un sitio donde nadie mira hasta que algo
 * se rompe en producción. Aquí hay pruebas que comprueban que los orígenes
 * reales del proyecto están permitidos y que los peligrosos no.
 *
 * La CSP se sirve en **Report-Only** salvo que `CSP_ENFORCE=true`. El motivo es
 * honesto: `next/image`, las fuentes de Google y el iframe del mapa introducen
 * orígenes que conviene observar antes de bloquear, y una CSP que rompe la web en
 * el primer despliegue se acaba desactivando entera. Report-Only permite recoger
 * las violaciones reales y pasar a bloqueo cuando la lista esté cerrada.
 */

/** Host del proyecto de Supabase, derivado de la variable y no escrito a mano. */
export function supabaseHost(supabaseUrl: string | undefined = process.env.SUPABASE_URL): string | null {
  if (!supabaseUrl) return null
  try {
    const { protocol, hostname } = new URL(supabaseUrl)
    return protocol === "https:" ? hostname : null
  } catch {
    return null
  }
}

/**
 * Directivas de la CSP.
 *
 * Cada excepción está aquí por un recurso que el proyecto usa de verdad:
 *
 * - `'unsafe-inline'` en `style-src`: Tailwind inyecta estilos en línea y los
 *   componentes usan `style={{...}}` para las animaciones de entrada. Quitarlo
 *   exigiría reescribir esas animaciones con clases y nonces por petición.
 * - `'unsafe-inline'` en `script-src`: Next.js emite scripts en línea para
 *   hidratar (`self.__next_f.push(...)`). La alternativa es una CSP con nonce por
 *   petición desde el middleware, que es la evolución natural pero exige tocar
 *   cada punto de render; queda anotado en docs/modelo-amenazas.md.
 * - **No** aparecen `fonts.googleapis.com` ni `fonts.gstatic.com`: desde la Fase 10
 *   las tipografías se sirven desde el propio dominio con `next/font/local` (ver
 *   app/fonts/README.md), así que el navegador no le pide nada a Google para
 *   pintar el texto y estas dos excepciones ya no hacen falta.
 * - `www.google.com` en `frame-src`: el iframe del mapa de la sección de contacto.
 * - El host de Supabase en `img-src` y `connect-src`: las URL firmadas del bucket
 *   privado y el cliente de Storage.
 * - `api.sendgrid.com` **no** aparece: el envío es servidor a servidor y nunca sale
 *   del navegador.
 */
export function buildContentSecurityPolicy(host: string | null = supabaseHost()): string {
  const supabase = host ? ` https://${host}` : ""

  return [
    "default-src 'self'",
    "base-uri 'self'",
    // Sin plugins ni applets: nada que embeber por esta vía.
    "object-src 'none'",
    // Impide que un tercero enmarque el sitio (clickjacking).
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // Las tipografías salen del propio dominio; `data:` se mantiene porque algún
    // navegador antiguo puede recibir una fuente incrustada del CSS de Tailwind.
    "font-src 'self' data:",
    `img-src 'self' data: blob:${supabase}`,
    `connect-src 'self'${supabase}`,
    // Solo el mapa. Cualquier otro iframe queda bloqueado.
    "frame-src https://www.google.com",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ")
}

export function isCspEnforced(): boolean {
  return process.env.CSP_ENFORCE?.trim() === "true"
}

/**
 * Cabeceras que se aplican a **todas** las rutas.
 *
 * `Strict-Transport-Security` no se incluye aquí: la fija la plataforma (Vercel lo
 * hace en todos los dominios que sirve por HTTPS) y ponerla desde la aplicación en
 * desarrollo, sobre `http://localhost`, obligaría al navegador a recordar que ese
 * host es solo-HTTPS y rompería el desarrollo local durante meses.
 *
 * `indexable` **se recibe, no se calcula aquí**, y no es una preferencia de
 * estilo: este módulo lo carga `next.config.mjs` con un `import` dinámico fuera
 * del grafo de módulos de Next, donde no se resuelve ni el alias `@/` ni una ruta
 * relativa sin extensión. Intentar importar `lib/seo/indexing` desde aquí rompe
 * el build con `Cannot find module`. Quien decide es `isSiteIndexable()`, y quien
 * lo llama es `next.config.mjs`, que sí puede importar los dos con extensión
 * explícita.
 *
 * El valor por defecto es **no indexable**, que es el lado seguro: si alguien
 * llama a esta función sin argumento, el resultado es un sitio de más excluido de
 * los buscadores, no un duplicado compitiendo contra el dominio del cliente.
 * `headers.test.ts` comprueba además que `next.config.mjs` pasa el valor real.
 */
export function securityHeaders({ indexable = false }: { indexable?: boolean } = {}): Array<{
  key: string
  value: string
}> {
  const csp = buildContentSecurityPolicy()

  const indexing: Array<{ key: string; value: string }> = indexable
    ? []
    : // Este despliegue no es el sitio oficial del negocio, así que no debe
      // aparecer en los buscadores: sería un duplicado compitiendo contra el
      // dominio del cliente. Se hace con una cabecera y no con un `Disallow: /`
      // a propósito —el motivo, en el comentario final de `app/robots.ts`— y se
      // aplica a todas las rutas, incluidas las imágenes y los PDF, que una
      // etiqueta `<meta>` no puede alcanzar.
      [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]

  return [
    ...indexing,
    {
      key: isCspEnforced() ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: csp,
    },
    // El navegador no adivina el tipo de contenido: un archivo subido que se
    // sirviera como texto no puede acabar interpretado como HTML o script.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Redundante con `frame-ancestors` para navegadores antiguos.
    { key: "X-Frame-Options", value: "DENY" },
    // No se filtra la ruta interna completa al navegar a un tercero. Una URL de
    // ficha VIP o de detalle de solicitud no tiene por qué viajar en el Referer.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // El sitio no usa cámara, micrófono ni geolocalización.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    // Aísla la ventana de otros orígenes que la abran.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Evita que otros sitios embeban recursos de este por accidente.
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    // El proyecto no ofrece ninguna API pública de datos.
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ]
}
