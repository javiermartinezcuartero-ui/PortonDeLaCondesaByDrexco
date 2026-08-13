/**
 * ¿Debe este despliegue aparecer en los buscadores?
 *
 * El problema que resuelve este módulo es concreto. La aplicación se sirve hoy en
 * `elportondelacondesa.solucionesbonicas.com`, un subdominio del sitio de
 * servicios del autor, mientras el negocio sigue teniendo su WordPress en
 * `elportondelacondesa.com`. Los dos publicarían el mismo contenido, y el sitemap
 * generado en el subdominio enumeraba URL del otro dominio: Search Console
 * rechaza un sitemap así, y si un buscador llegara a indexar el subdominio
 * competiría contra el sitio real del cliente.
 *
 * La regla es por tanto **una sola**: solo se indexa el despliegue que se sirve
 * desde el dominio oficial del negocio. Cualquier otro origen —el subdominio de
 * demostración, una preview de Vercel, `localhost`— queda fuera de los buscadores
 * sin que nadie tenga que acordarse de configurar nada. El día que la aplicación
 * sustituya al WordPress y `NEXT_PUBLIC_SITE_URL` pase a ser el dominio oficial,
 * la indexación se activa sola.
 *
 * **Por defecto no se indexa.** Sin `NEXT_PUBLIC_SITE_URL`, la respuesta es que
 * no. Es la única opción segura: un despliegue que no declara desde dónde se
 * sirve tampoco puede afirmar que es el sitio canónico.
 *
 * Este módulo **no importa nada**, y no es casualidad: `next.config.mjs` carga
 * `lib/security/headers.ts` con un `import` dinámico fuera del grafo de módulos de
 * Next, donde el alias `@/` no se resuelve. De ahí que el origen canónico se
 * repita aquí como constante en lugar de leerse de `data/site-content.ts`.
 * `lib/seo/indexing.test.ts` compara las dos y falla si alguien cambia una sin la
 * otra, que es lo que convierte la duplicación en algo verificado.
 */

/** Origen oficial del negocio. Debe coincidir con `brand.website`. */
export const CANONICAL_SITE_ORIGIN = "https://elportondelacondesa.com"

/**
 * Origen en minúsculas de una URL, o `null` si no es una URL absoluta válida.
 *
 * Se compara el origen y no la cadena entera para que la barra final, la ruta o
 * el puerto por defecto no provoquen una diferencia que no existe.
 */
export function normalizeOrigin(url: string | undefined | null): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null

  try {
    return new URL(trimmed).origin.toLowerCase()
  } catch {
    return null
  }
}

/**
 * `true` solo si este despliegue se sirve desde el dominio oficial del negocio.
 *
 * `www.` se ignora en la comparación. No es purismo: escribir el dominio con o
 * sin `www` es la diferencia más fácil de introducir al rellenar una variable en
 * Vercel, y el precio de equivocarse aquí sería un sitio oficial que nunca llega
 * a indexarse sin que nada avise. Un subdominio distinto de `www` —el de
 * demostración, sin ir más lejos— sigue contando como otro sitio.
 *
 * El parámetro existe para las pruebas; en ejecución sale siempre del entorno.
 */
export function isSiteIndexable(siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): boolean {
  const served = normalizeOrigin(siteUrl)
  if (!served) return false

  return withoutWww(served) === withoutWww(normalizeOrigin(CANONICAL_SITE_ORIGIN))
}

function withoutWww(origin: string | null): string | null {
  return origin?.replace("://www.", "://") ?? null
}
