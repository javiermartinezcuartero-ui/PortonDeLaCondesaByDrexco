"use client"

import Link from "next/link"
import Image from "next/image"
import { useLocale } from "@/lib/i18n"

/**
 * Props de presentación de una tarjeta de ficha. Es un tipo plano a propósito:
 * el componente no conoce Prisma ni el CMS (ver lib/content/to-story-card.ts).
 */
export type StoryCardData = {
  slug: string
  title: string
  subtitle?: string
  season?: string
  space?: string
  heroImage?: { src: string; alt: string }
  /** Contenido de ejemplo: obliga a mostrar el aviso inequívoco. */
  isExample: boolean
}

const labels = {
  es: { example: "Ejemplo ilustrativo" },
  en: { example: "Illustrative example" },
} as const

export function StoryCard({ story, basePath }: { story: StoryCardData; basePath: string }) {
  const { locale } = useLocale()
  const meta = [story.season, story.space].filter(Boolean).join(" · ")

  return (
    <Link href={`${basePath}/${story.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        {story.heroImage && (
          <Image
            src={story.heroImage.src}
            alt={story.heroImage.alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        )}
        {story.isExample && (
          <span className="absolute top-4 left-4 bg-background/90 px-3 py-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            {labels[locale].example}
          </span>
        )}
      </div>
      <div className="pt-4 space-y-1">
        {meta && <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{meta}</span>}
        <h3 className="font-serif text-2xl font-light text-foreground group-hover:text-accent transition-colors duration-300">
          {story.title}
        </h3>
        {story.subtitle && <p className="text-sm text-muted-foreground italic">{story.subtitle}</p>}
      </div>
    </Link>
  )
}
