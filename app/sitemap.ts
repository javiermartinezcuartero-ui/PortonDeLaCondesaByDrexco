import type { MetadataRoute } from "next"
import { brand } from "@/data/site-content"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = brand.website.replace(/\/$/, "")

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/aviso-legal`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/politica-privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/politica-cookies`, changeFrequency: "yearly", priority: 0.2 },
    // Las bibliotecas VIP (/bodas-reales, /catering) y sus fichas se excluyen
    // a propósito: su contenido está detrás del gate de email, así que un
    // buscador solo vería el formulario. Incluir los slugs además revelaría
    // qué fichas existen sin que nadie haya dejado su email.
    // Se añadirán cuando (y si) parte del contenido pase a ser público.
  ]
}
