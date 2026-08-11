import type { MetadataRoute } from "next"
import { brand } from "@/data/site-content"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = brand.website.replace(/\/$/, "")

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/aviso-legal`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/politica-privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/politica-cookies`, changeFrequency: "yearly", priority: 0.2 },
    // /bodas-reales y /catering se excluyen del sitemap mientras muestren
    // ejemplos ilustrativos (ver data/vip-stories.ts).
  ]
}
