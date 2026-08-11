import type { MetadataRoute } from "next"
import { brand } from "@/data/site-content"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${brand.website}sitemap.xml`,
  }
}

// Nota: /bodas-reales y /catering muestran ejemplos ilustrativos mientras no
// haya casos reales publicados (ver TODO en data/vip-stories.ts). En lugar de
// bloquear el rastreo aquí (lo que no impide que Google indexe la URL si hay
// enlaces internos), se marcan con `robots: { index: false }` en cada page.tsx
// correspondiente — la forma correcta de excluir contenido de los resultados.
