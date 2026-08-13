import type { MetadataRoute } from "next"
import { brand } from "@/data/site-content"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // El panel y la API no son contenido: no hay nada que un buscador pueda
      // mostrar y sí un formulario de acceso que no necesita rastreadores
      // encima. Ver la nota de abajo sobre por qué aquí sí y en las
      // bibliotecas VIP no.
      disallow: ["/admin", "/api"],
    },
    sitemap: `${brand.website}sitemap.xml`,
  }
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
