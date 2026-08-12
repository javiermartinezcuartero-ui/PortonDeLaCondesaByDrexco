"use client"

import Image from "next/image"
import Link from "next/link"
import { PlayCircle } from "lucide-react"
import { useLocale } from "@/lib/i18n"
import type { EventTypeCode } from "@/lib/validation/lead-request"

/**
 * Forma de datos que renderiza esta ficha. Todas las secciones son opcionales
 * porque la preview del panel (/admin/contenidos/[id]/preview) muestra
 * borradores que legítimamente pueden no tener minuta, cronología, hero o
 * presupuesto todavía. `VipStory` (data/vip-stories.ts) es asignable a este
 * tipo, así que las páginas públicas siguen funcionando sin cambios.
 */
export type StoryDetailData = {
  isExample?: boolean
  /**
   * Id de la `ContentEntry` que originó la ficha. Viaja en el CTA para que la
   * solicitud comercial quede atribuida a esta ficha (`LeadRequest.sourceContentId`).
   * Ausente cuando la ficha no viene de la base de datos.
   */
  contentId?: string
  title: string
  subtitle?: string
  intro?: string
  season?: string
  space?: string
  heroImage?: { src: string; alt: string }
  gallery?: { src: string; alt: string; isVideo?: boolean }[]
  timing?: { time: string; moment: string }[]
  menu?: { course: string; items: string[] }[]
  decor?: string
  photocall?: string
  surprises?: string[]
  providers?: { category: string; name: string; image?: { src: string; alt: string }; isVideo?: boolean }[]
  weather?: string
  restaurantSolutions?: string
  testimonialQuote?: string
  testimonialAuthor?: string
  priceRange?: { from: number; to: number; currency: string; note: string }
  ctaLabel?: string
  ctaHref?: string
}

/**
 * Enlace del CTA "Quiero una boda así" / "Quiero un catering así": lleva al
 * formulario de la home con el tipo de evento preseleccionado y la ficha como
 * origen, de modo que la solicitud quede atribuida a lo que la persona estaba
 * viendo (ver docs/flujo-captacion.md).
 *
 * Una ficha de catering preselecciona `EXTERNAL_CATERING` como valor de partida
 * razonable; la persona puede cambiar el desplegable si su evento es otro.
 */
export function contactHrefForStory(kind: "bodas" | "catering", contentId?: string): string {
  const eventType: EventTypeCode = kind === "bodas" ? "WEDDING" : "EXTERNAL_CATERING"
  const params = new URLSearchParams({ tipo: eventType })
  if (contentId) params.set("ficha", contentId)
  return `/?${params.toString()}#contacto`
}

const labels = {
  es: {
    example: "Ejemplo ilustrativo",
    gallery: "Galería de fotos y vídeos",
    timing: "Tiempos de pase",
    menu: "Minuta",
    decor: "Decoración",
    photocall: "Photocall",
    surprises: "Momentos especiales",
    solutions: "Cómo lo resolvimos",
    providers: "Proveedores",
    opinion: "Opinión",
    thanksVideo: "Vídeo de agradecimiento (ejemplo)",
    budget: "Presupuesto orientativo",
    budgetNote: "Cifra de ejemplo, sujeta a presupuesto real.",
    locale: "es-ES",
    backLabel: { bodas: "Todas las bodas reales", catering: "Todos los eventos de catering" },
    ctaLabel: { bodas: "Quiero una boda así", catering: "Quiero un catering así" },
  },
  en: {
    example: "Illustrative example",
    gallery: "Photo & video gallery",
    timing: "Event schedule",
    menu: "Menu",
    decor: "Decoration",
    photocall: "Photo booth",
    surprises: "Special moments",
    solutions: "How we made it work",
    providers: "Suppliers",
    opinion: "Review",
    thanksVideo: "Thank-you video (example)",
    budget: "Estimated budget",
    budgetNote: "Example figure, subject to an actual quote.",
    locale: "en-GB",
    backLabel: { bodas: "All real weddings", catering: "All catering events" },
    ctaLabel: { bodas: "I want a wedding like this", catering: "I want catering like this" },
  },
} as const

function MediaThumb({ src, alt, isVideo }: { src: string; alt: string; isVideo?: boolean }) {
  return (
    <div className="relative aspect-square overflow-hidden bg-secondary">
      <Image src={src} alt={alt} fill className="object-cover" sizes="33vw" />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
          <PlayCircle className="h-8 w-8 text-primary-foreground drop-shadow" />
        </div>
      )}
    </div>
  )
}

export function StoryDetail({
  story,
  backHref,
  kind,
}: {
  story: StoryDetailData
  backHref: string
  kind: "bodas" | "catering"
}) {
  const { locale } = useLocale()
  const t = labels[locale]
  const backLabel = t.backLabel[kind]
  const ctaLabel = story.ctaLabel ?? t.ctaLabel[kind]
  // Un `ctaHref` definido en el CMS manda tal cual (es una decisión explícita
  // del editor); si no lo hay, el enlace lleva al formulario de la home con el
  // tipo de evento y la ficha ya precargados.
  const ctaHref = story.ctaHref ?? contactHrefForStory(kind, story.contentId)
  const meta = [story.season, story.space].filter(Boolean).join(" · ")
  const providersWithImage = (story.providers ?? []).filter(
    (provider): provider is typeof provider & { image: { src: string; alt: string } } => Boolean(provider.image)
  )

  return (
    <article className="pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <Link href={backHref} className="text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300">
          ← {backLabel}
        </Link>

        {(story.isExample || meta) && (
          <div className="mt-8 flex items-center gap-4">
            {story.isExample && (
              <span className="bg-secondary px-3 py-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                {t.example}
              </span>
            )}
            {meta && <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{meta}</span>}
          </div>
        )}

        <h1 className="mt-4 font-serif text-4xl md:text-6xl font-light text-foreground max-w-3xl">{story.title}</h1>
        {story.subtitle && <p className="mt-3 text-lg text-muted-foreground italic max-w-xl">{story.subtitle}</p>}
        {story.intro && <p className="mt-6 text-foreground/80 leading-relaxed max-w-2xl">{story.intro}</p>}

        {story.heroImage && (
          <div className="relative aspect-[16/9] mt-12 overflow-hidden">
            <Image src={story.heroImage.src} alt={story.heroImage.alt} fill className="object-cover" sizes="100vw" priority />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-12 mt-16">
          <div className="lg:col-span-2 space-y-12">
            {story.gallery && story.gallery.length > 0 && (
              <section>
                <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">{t.gallery}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {story.gallery.map((image, index) => (
                    <MediaThumb key={image.src + index} src={image.src} alt={image.alt} isVideo={image.isVideo} />
                  ))}
                </div>
              </section>
            )}

            {story.timing && story.timing.length > 0 && (
              <section>
                <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">{t.timing}</h2>
                <ul className="divide-y divide-border">
                  {story.timing.map((slot, index) => (
                    <li key={`${slot.time}-${index}`} className="flex items-center gap-6 py-3">
                      <span className="font-mono text-sm text-muted-foreground w-14 shrink-0">{slot.time}</span>
                      <span className="text-foreground/80">{slot.moment}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {story.menu && story.menu.length > 0 && (
              <section>
                <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">{t.menu}</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  {story.menu.map((course, courseIndex) => (
                    <div key={`${course.course}-${courseIndex}`}>
                      <h3 className="font-serif text-lg font-light text-foreground mb-2">{course.course}</h3>
                      <ul className="space-y-1.5">
                        {course.items.map((item, itemIndex) => (
                          <li key={`${item}-${itemIndex}`} className="flex items-start gap-3 text-sm text-foreground/80">
                            <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(story.decor || story.photocall) && (
              <section className="grid md:grid-cols-2 gap-8">
                {story.decor && (
                  <div>
                    <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{t.decor}</h2>
                    <p className="text-foreground/80 leading-relaxed">{story.decor}</p>
                  </div>
                )}
                {story.photocall && (
                  <div>
                    <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{t.photocall}</h2>
                    <p className="text-foreground/80 leading-relaxed">{story.photocall}</p>
                  </div>
                )}
              </section>
            )}

            {story.surprises && story.surprises.length > 0 && (
              <section>
                <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">{t.surprises}</h2>
                <ul className="space-y-2">
                  {story.surprises.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-start gap-3 text-foreground/80">
                      <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(story.restaurantSolutions || story.weather) && (
              <section>
                <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{t.solutions}</h2>
                {story.restaurantSolutions && (
                  <p className="text-foreground/80 leading-relaxed">{story.restaurantSolutions}</p>
                )}
                {story.weather && <p className="text-sm text-muted-foreground mt-2 italic">{story.weather}</p>}
              </section>
            )}

            {providersWithImage.length > 0 && (
              <section>
                <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">{t.providers}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {providersWithImage.map((provider, index) => (
                    <div key={`${provider.name}-${index}`} className="space-y-2">
                      <MediaThumb src={provider.image.src} alt={provider.image.alt} isVideo={provider.isVideo} />
                      <div>
                        <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">{provider.category}</p>
                        <p className="text-sm text-foreground/80">{provider.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-8">
            {story.testimonialQuote && (
              <div className="bg-primary text-primary-foreground p-8 space-y-4">
                <h2 className="text-xs tracking-[0.2em] uppercase text-primary-foreground/60">{t.opinion}</h2>
                <p className="font-serif text-xl font-light leading-relaxed">“{story.testimonialQuote}”</p>
                {story.testimonialAuthor && (
                  <p className="text-sm text-primary-foreground/70">{story.testimonialAuthor}</p>
                )}
              </div>
            )}

            <div className="relative aspect-video overflow-hidden bg-secondary flex items-center justify-center group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-primary/20" />
              <PlayCircle className="relative z-10 h-16 w-16 text-primary-foreground transition-transform duration-300 group-hover:scale-110" />
              <span className="absolute bottom-4 left-4 right-4 text-xs tracking-[0.15em] uppercase text-primary-foreground/90 z-10">
                {t.thanksVideo}
              </span>
            </div>

            {story.priceRange && (
              <div className="border border-border p-6 space-y-2">
                <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.budget}</h2>
                <p className="font-serif text-2xl font-light text-foreground">
                  {story.priceRange.from.toLocaleString(t.locale)}–{story.priceRange.to.toLocaleString(t.locale)} {story.priceRange.currency}
                </p>
                {story.priceRange.note && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{story.priceRange.note}</p>
                )}
                <p className="text-xs text-muted-foreground italic pt-1">{t.budgetNote}</p>
              </div>
            )}

            <Link
              href={ctaHref}
              className="group flex items-center justify-center gap-3 w-full px-6 py-4 text-sm tracking-[0.15em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300"
            >
              {ctaLabel}
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
