import type { MetadataRoute } from "next"
import { brand } from "@/data/site-content"
import { isSiteIndexable } from "@/lib/seo/indexing"

export default function robots(): MetadataRoute.Robots {
  const rules = {
    userAgent: "*",
    allow: "/",
    // El panel y la API no son contenido: no hay nada que un buscador pueda
    // mostrar y sí un formulario de acceso que no necesita rastreadores
    // encima. Ver la nota de abajo sobre por qué aquí sí y en las
    // bibliotecas VIP no.
    disallow: ["/admin", "/api"],
  }

  // Un despliegue que no es el sitio oficial no declara sitemap: un sitemap es
  // una petición explícita de indexación, y este despliegue pide justo lo
  // contrario con `X-Robots-Tag` (lib/security/headers.ts).
  if (!isSiteIndexable()) {
    return { rules }
  }

  return { rules, sitemap: `${brand.website}sitemap.xml` }
}

// Dos mecanismos distintos para dos problemas distintos:
//
// - `/admin` y `/api`: `Disallow` aquí. Sabemos que su contenido no debe
//   aparecer nunca y no perdemos nada impidiendo el rastreo. El efecto
//   secundario conocido de `Disallow` —un buscador puede indexar la URL a secas
//   si alguien la enlaza, porque al no rastrearla no llega a leer el
//   `noindex`— es inofensivo aquí: sería una entrada sin título ni descripción
//   apuntando a una pantalla de acceso. El `robots: { index: false }` de
//   `app/admin/(protected)/layout.tsx` y de `app/admin/login/page.tsx` se
//   mantiene igualmente, por si `robots.txt` no se respeta.
//
// - `/bodas-reales` y `/catering`: **no** se bloquean aquí. Son rutas que algún
//   día serán públicas, y para excluir contenido de los resultados sin renunciar
//   al rastreo la forma correcta es el `noindex` de cada `page.tsx`
//   (`lib/vip/metadata.ts`), que es lo que se hace. Bloquearlas en `robots.txt`
//   daría exactamente el resultado que se quiere evitar: URLs indexadas sin
//   que nadie pueda leer la etiqueta que pide no indexarlas.
//
// Y por la misma razón, el despliegue de demostración **no** emite un
// `Disallow: /` pese a estar excluido entero de los buscadores. Sería el mismo
// error a mayor escala: el rastreador no llegaría a leer el `X-Robots-Tag:
// noindex` que lo excluye de verdad, y Google puede listar una URL bloqueada por
// `robots.txt` —sin título ni descripción, con el aviso de que no hay
// información disponible— si alguien la enlaza desde fuera. Para desaparecer de
// los resultados hay que **dejar rastrear y decir que no se indexe**, que es
// exactamente lo contrario de lo que sugiere la intuición.
