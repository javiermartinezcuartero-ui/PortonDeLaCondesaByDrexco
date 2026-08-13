import type { MetadataRoute } from "next"
import { brand } from "@/data/site-content"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = brand.website.replace(/\/$/, "")

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    // Las tres páginas legales NO van aquí, aunque parezca natural incluirlas.
    //
    // Cada una emite `robots: { index: false, follow: true }` en su `page.tsx`:
    // se rastrean, se siguen sus enlaces, y no se indexan. Un sitemap es una
    // petición explícita de indexación, así que declararlas aquí era pedir dos
    // cosas contrarias a la vez. El efecto práctico: Search Console habría
    // marcado como error de cobertura tres de las cuatro URL enviadas
    // ("Excluida por la etiqueta noindex") desde el primer rastreo.
    //
    // Se ha alineado el sitemap con el `noindex`, y no al contrario, porque el
    // `follow: true` de esas páginas es una decisión deliberada y esta es la
    // opción que no cambia qué se indexa. Si algún día se quiere que las
    // páginas legales aparezcan en búsquedas —es defendible: son información
    // pública de la empresa— hay que quitar el `noindex` de los tres `page.tsx`
    // Y volver a añadirlas aquí, no una cosa sin la otra.
    //
    // Las bibliotecas VIP (/bodas-reales, /catering) y sus fichas se excluyen por
    // otro motivo: su contenido está detrás del gate de correo, así que un
    // buscador solo vería el formulario. Y publicar los slugs revelaría qué
    // fichas existen sin que nadie haya dejado su correo. Se añadirán cuando (y
    // si) parte del contenido pase a ser público.
  ]
}
