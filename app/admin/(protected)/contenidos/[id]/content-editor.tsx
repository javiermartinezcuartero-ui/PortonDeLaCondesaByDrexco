"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ContentStatus, ContentType } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { slugify } from "@/lib/slug"
import {
  archiveContentEntryAction,
  deleteContentMediaAction,
  publishContentEntryAction,
  saveContentEntryAction,
  unpublishContentEntryAction,
  uploadContentImageAction,
} from "../actions"
import { MediaPanel } from "./media-panel"
import type { EditorMedia } from "./editor-media"

// Se reexporta para no romper a quien ya lo importaba desde aquí; la definición
// vive en `editor-media.ts`, que también la comparten la página y la acción de
// subida (así un archivo nuevo se construye igual que los ya guardados).
export type { EditorMedia }

type Translation = {
  title: string
  subtitle: string
  intro: string
  seoTitle: string
  seoDescription: string
}

export type EditorState = {
  id: string
  updatedAt: string
  status: ContentStatus
  type: ContentType
  slug: string
  isDemo: boolean
  featured: boolean
  sortOrder: number
  seoNoindex: boolean
  eventDate: string
  season: string
  space: string
  decor: string
  photocall: string
  weather: string
  restaurantSolutions: string
  testimonialQuote: string
  testimonialAuthor: string
  priceFrom: string
  priceTo: string
  priceCurrency: string
  priceNote: string
  ctaLabel: string
  ctaHref: string
  translations: { es: Translation; en: Translation }
  media: EditorMedia[]
  providers: { category: string; name: string; mediaId: string }[]
  menuSections: { course: string; items: string[] }[]
  timeline: { time: string; moment: string }[]
  highlights: string[]
}

type SaveState = "idle" | "saving" | "saved" | "error"

const labelClass = "text-xs tracking-[0.2em] uppercase text-muted-foreground"
const sectionClass = "space-y-5 border-t border-border pt-8"
const smallButtonClass =
  "text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors duration-300 disabled:opacity-50"

/** Campo de texto simple con etiqueta asociada. */
function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  hint?: string
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <Textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="resize-y" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Lista ordenada de textos simples (momentos especiales, platos de un pase). */
function StringList({
  legend,
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  legend: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  addLabel: string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className={labelClass}>{legend}</legend>
      <ul className="space-y-2 pt-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              value={item}
              placeholder={placeholder}
              aria-label={`${legend} — elemento ${index + 1}`}
              onChange={(event) => {
                const next = [...items]
                next[index] = event.target.value
                onChange(next)
              }}
            />
            <button
              type="button"
              className={smallButtonClass}
              onClick={() => onChange(items.filter((_, position) => position !== index))}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={smallButtonClass} onClick={() => onChange([...items, ""])}>
        + {addLabel}
      </button>
    </fieldset>
  )
}

export function ContentEditor({
  entry,
  missingToPublish,
  storageConfigured,
}: {
  entry: EditorState
  missingToPublish: string[]
  storageConfigured: boolean
}) {
  const router = useRouter()
  const [state, setState] = useState<EditorState>(entry)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [errors, setErrors] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  // Instantánea de lo último guardado: comparar contra ella es lo que permite
  // saber si hay cambios sin guardar sin marcar cada campo a mano. Va en
  // estado, no en un ref, porque el indicador "Cambios sin guardar" se
  // renderiza a partir de esta comparación.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(entry))
  const isDirty = useMemo(() => JSON.stringify(state) !== savedSnapshot, [state, savedSnapshot])

  const update = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setState((previous) => ({ ...previous, [key]: value }))
    if (saveState === "saved") setSaveState("idle")
  }

  const updateTranslation = (locale: "es" | "en", key: keyof Translation, value: string) => {
    setState((previous) => ({
      ...previous,
      translations: { ...previous.translations, [locale]: { ...previous.translations[locale], [key]: value } },
    }))
    if (saveState === "saved") setSaveState("idle")
  }

  const buildPayload = () => ({
    id: state.id,
    expectedUpdatedAt: state.updatedAt,
    type: state.type,
    slug: state.slug,
    isDemo: state.isDemo,
    featured: state.featured,
    sortOrder: state.sortOrder,
    seoNoindex: state.seoNoindex,
    eventDate: state.eventDate || undefined,
    season: state.season,
    space: state.space,
    decor: state.decor,
    photocall: state.photocall,
    weather: state.weather,
    restaurantSolutions: state.restaurantSolutions,
    testimonialQuote: state.testimonialQuote,
    testimonialAuthor: state.testimonialAuthor,
    priceFrom: state.priceFrom,
    priceTo: state.priceTo,
    priceCurrency: state.priceCurrency,
    priceNote: state.priceNote,
    ctaLabel: state.ctaLabel,
    ctaHref: state.ctaHref,
    translations: { es: state.translations.es, en: state.translations.en },
    media: state.media.map((item, index) => ({
      id: item.id,
      alt: item.alt,
      caption: item.caption,
      sortOrder: index,
      isHero: item.isHero,
      inGallery: item.inGallery,
    })),
    providers: state.providers.map((provider) => ({
      category: provider.category,
      name: provider.name,
      mediaId: provider.mediaId || undefined,
    })),
    menuSections: state.menuSections.map((section) => ({
      course: section.course,
      items: section.items.filter((item) => item.trim()),
    })),
    timeline: state.timeline,
    highlights: state.highlights.filter((item) => item.trim()),
  })

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setErrors([])
    setSaveState("saving")

    startTransition(async () => {
      const result = await saveContentEntryAction(buildPayload())
      if (!result.ok) {
        setErrors(result.errors)
        setSaveState("error")
        return
      }
      // `updatedAt` avanza en cada guardado: hay que refrescarlo o el próximo
      // envío se rechazaría por conflicto de concurrencia.
      const nextState = { ...state, updatedAt: result.data.updatedAt }
      setSavedSnapshot(JSON.stringify(nextState))
      setState(nextState)
      setSaveState("saved")
      router.refresh()
    })
  }

  const runLifecycle = (operation: () => Promise<{ ok: boolean; errors?: string[] }>) => {
    setErrors([])
    startTransition(async () => {
      const result = await operation()
      if (!result.ok) {
        setErrors(result.errors ?? ["No se ha podido completar la operación."])
        setSaveState("error")
        return
      }
      router.refresh()
    })
  }

  const canPublish = missingToPublish.length === 0

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {/* Barra de estado: guardando / guardado / error / cambios sin guardar */}
      <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-4 text-xs">
          <span className="uppercase tracking-[0.15em] text-muted-foreground">
            {state.status === "PUBLISHED" ? "Publicado" : state.status === "ARCHIVED" ? "Archivado" : "Borrador"}
          </span>
          <span aria-live="polite" className="text-muted-foreground">
            {saveState === "saving" && "Guardando…"}
            {saveState === "saved" && !isDirty && "Guardado"}
            {saveState === "error" && <span className="text-destructive">Error al guardar</span>}
            {saveState !== "saving" && isDirty && "Cambios sin guardar"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {state.status === "PUBLISHED" ? (
            <button
              type="button"
              className={smallButtonClass}
              disabled={isPending}
              onClick={() => runLifecycle(() => unpublishContentEntryAction(state.id))}
            >
              Despublicar
            </button>
          ) : (
            <button
              type="button"
              className={smallButtonClass}
              disabled={isPending || !canPublish}
              title={canPublish ? undefined : `Faltan: ${missingToPublish.join(", ")}`}
              onClick={() => runLifecycle(() => publishContentEntryAction(state.id))}
            >
              Publicar
            </button>
          )}
          {state.status !== "ARCHIVED" && (
            <button
              type="button"
              className={smallButtonClass}
              disabled={isPending}
              onClick={() => {
                if (!window.confirm("¿Archivar esta ficha? Dejará de estar disponible en la web pública.")) return
                runLifecycle(() => archiveContentEntryAction(state.id))
              }}
            >
              Archivar
            </button>
          )}
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="px-5 py-2 text-xs tracking-[0.15em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300 disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {!canPublish && state.status !== "PUBLISHED" && (
        <p className="border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          Para poder publicar falta: {missingToPublish.join(", ")}.
        </p>
      )}

      {/* --- Identidad --- */}
      <section className="space-y-5">
        <h2 className="font-serif text-xl font-light text-foreground">Identidad</h2>

        <div className="space-y-1.5">
          <label htmlFor="type" className={labelClass}>
            Tipo
          </label>
          <select
            id="type"
            value={state.type}
            onChange={(event) => update("type", event.target.value as ContentType)}
            className="border border-border bg-transparent px-2 py-2 text-sm text-foreground"
          >
            <option value="REAL_WEDDING">Boda real</option>
            <option value="CATERING_EVENT">Evento de catering</option>
          </select>
        </div>

        <Field
          id="slug"
          label="Slug"
          value={state.slug}
          onChange={(value) => update("slug", value)}
          hint="Solo minúsculas, números y guiones. Se valida en servidor y debe ser único por tipo."
        />
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => update("slug", slugify(state.translations.es.title))}
        >
          Sugerir slug desde el título
        </button>

        <div className="grid gap-5 md:grid-cols-3">
          <Field id="eventDate" label="Fecha del evento" type="date" value={state.eventDate} onChange={(value) => update("eventDate", value)} />
          <Field id="season" label="Temporada" value={state.season} onChange={(value) => update("season", value)} hint="Ej. Otoño 2025" />
          <Field id="space" label="Espacio" value={state.space} onChange={(value) => update("space", value)} />
        </div>
      </section>

      {/* --- Textos en español --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">
          Español <span className="text-sm text-muted-foreground">(obligatorio)</span>
        </h2>
        <Field id="es-title" label="Título" value={state.translations.es.title} onChange={(value) => updateTranslation("es", "title", value)} />
        <Field id="es-subtitle" label="Subtítulo" value={state.translations.es.subtitle} onChange={(value) => updateTranslation("es", "subtitle", value)} />
        <TextField id="es-intro" label="Introducción" rows={4} value={state.translations.es.intro} onChange={(value) => updateTranslation("es", "intro", value)} />
      </section>

      {/* --- Textos en inglés --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">
          Inglés <span className="text-sm text-muted-foreground">(opcional)</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Si rellenas cualquier campo en inglés, el título en inglés pasa a ser obligatorio. Dejarlo todo vacío elimina
          la traducción inglesa.
        </p>
        <Field id="en-title" label="Title" value={state.translations.en.title} onChange={(value) => updateTranslation("en", "title", value)} />
        <Field id="en-subtitle" label="Subtitle" value={state.translations.en.subtitle} onChange={(value) => updateTranslation("en", "subtitle", value)} />
        <TextField id="en-intro" label="Intro" rows={4} value={state.translations.en.intro} onChange={(value) => updateTranslation("en", "intro", value)} />
      </section>

      {/* --- Media --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Fotos y vídeos</h2>
        <MediaPanel
          contentEntryId={state.id}
          media={state.media}
          storageConfigured={storageConfigured}
          onChange={(media) => update("media", media)}
          onUpload={uploadContentImageAction}
          onDelete={deleteContentMediaAction}
        />
      </section>

      {/* --- Ambiente --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Decoración y photocall</h2>
        <TextField id="decor" label="Decoración" value={state.decor} onChange={(value) => update("decor", value)} />
        <TextField id="photocall" label="Photocall" value={state.photocall} onChange={(value) => update("photocall", value)} />
      </section>

      {/* --- Minuta --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Minuta</h2>
        {state.menuSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-3 border border-border p-4">
            <div className="flex items-end gap-2">
              <Field
                id={`menu-course-${sectionIndex}`}
                label="Pase"
                className="flex-1"
                value={section.course}
                onChange={(value) => {
                  const next = [...state.menuSections]
                  next[sectionIndex] = { ...next[sectionIndex], course: value }
                  update("menuSections", next)
                }}
              />
              <button
                type="button"
                className={smallButtonClass}
                onClick={() => update("menuSections", state.menuSections.filter((_, index) => index !== sectionIndex))}
              >
                Quitar pase
              </button>
            </div>
            <StringList
              legend="Platos"
              items={section.items}
              placeholder="Nombre del plato"
              addLabel="Añadir plato"
              onChange={(items) => {
                const next = [...state.menuSections]
                next[sectionIndex] = { ...next[sectionIndex], items }
                update("menuSections", next)
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => update("menuSections", [...state.menuSections, { course: "", items: [""] }])}
        >
          + Añadir pase
        </button>
      </section>

      {/* --- Cronología --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Cronología</h2>
        <ul className="space-y-2">
          {state.timeline.map((slot, index) => (
            <li key={index} className="flex items-end gap-2">
              <Field
                id={`timeline-time-${index}`}
                label="Hora"
                className="w-28"
                value={slot.time}
                onChange={(value) => {
                  const next = [...state.timeline]
                  next[index] = { ...next[index], time: value }
                  update("timeline", next)
                }}
              />
              <Field
                id={`timeline-moment-${index}`}
                label="Momento"
                className="flex-1"
                value={slot.moment}
                onChange={(value) => {
                  const next = [...state.timeline]
                  next[index] = { ...next[index], moment: value }
                  update("timeline", next)
                }}
              />
              <button
                type="button"
                className={smallButtonClass}
                onClick={() => update("timeline", state.timeline.filter((_, position) => position !== index))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => update("timeline", [...state.timeline, { time: "", moment: "" }])}
        >
          + Añadir hora
        </button>
      </section>

      {/* --- Momentos especiales --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Momentos especiales</h2>
        <StringList
          legend="Momentos"
          items={state.highlights}
          placeholder="Describe el momento"
          addLabel="Añadir momento"
          onChange={(highlights) => update("highlights", highlights)}
        />
      </section>

      {/* --- Proveedores --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Proveedores</h2>
        <ul className="space-y-3">
          {state.providers.map((provider, index) => (
            <li key={index} className="flex flex-wrap items-end gap-2 border border-border p-3">
              <Field
                id={`provider-category-${index}`}
                label="Categoría"
                className="w-40"
                value={provider.category}
                onChange={(value) => {
                  const next = [...state.providers]
                  next[index] = { ...next[index], category: value }
                  update("providers", next)
                }}
              />
              <Field
                id={`provider-name-${index}`}
                label="Nombre"
                className="min-w-[200px] flex-1"
                value={provider.name}
                onChange={(value) => {
                  const next = [...state.providers]
                  next[index] = { ...next[index], name: value }
                  update("providers", next)
                }}
              />
              <div className="space-y-1.5">
                <label htmlFor={`provider-media-${index}`} className={labelClass}>
                  Imagen asociada
                </label>
                <select
                  id={`provider-media-${index}`}
                  value={provider.mediaId}
                  onChange={(event) => {
                    const next = [...state.providers]
                    next[index] = { ...next[index], mediaId: event.target.value }
                    update("providers", next)
                  }}
                  className="border border-border bg-transparent px-2 py-2 text-sm text-foreground"
                >
                  <option value="">Ninguna</option>
                  {state.media.map((media, mediaIndex) => (
                    <option key={media.id} value={media.id}>
                      #{mediaIndex + 1} {media.alt || "(sin alt)"}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={smallButtonClass}
                onClick={() => update("providers", state.providers.filter((_, position) => position !== index))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => update("providers", [...state.providers, { category: "", name: "", mediaId: "" }])}
        >
          + Añadir proveedor
        </button>
      </section>

      {/* --- Tiempo y solución del equipo --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Tiempo y solución del equipo</h2>
        <TextField id="weather" label="Tiempo" value={state.weather} onChange={(value) => update("weather", value)} rows={2} />
        <TextField
          id="restaurantSolutions"
          label="Cómo lo resolvimos"
          value={state.restaurantSolutions}
          onChange={(value) => update("restaurantSolutions", value)}
        />
      </section>

      {/* --- Testimonio --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Testimonio</h2>
        <TextField
          id="testimonialQuote"
          label="Opinión"
          value={state.testimonialQuote}
          onChange={(value) => update("testimonialQuote", value)}
        />
        <Field
          id="testimonialAuthor"
          label="Autoría"
          value={state.testimonialAuthor}
          onChange={(value) => update("testimonialAuthor", value)}
        />
      </section>

      {/* --- Presupuesto --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">
          Presupuesto <span className="text-sm text-muted-foreground">(opcional)</span>
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          <Field id="priceFrom" label="Desde" type="number" value={state.priceFrom} onChange={(value) => update("priceFrom", value)} />
          <Field id="priceTo" label="Hasta" type="number" value={state.priceTo} onChange={(value) => update("priceTo", value)} />
          <Field id="priceCurrency" label="Moneda" value={state.priceCurrency} onChange={(value) => update("priceCurrency", value)} hint="Ej. €" />
        </div>
        <TextField id="priceNote" label="Nota del presupuesto" rows={2} value={state.priceNote} onChange={(value) => update("priceNote", value)} />
      </section>

      {/* --- CTA --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Llamada a la acción</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="ctaLabel" label="Texto del botón" value={state.ctaLabel} onChange={(value) => update("ctaLabel", value)} hint="Si se deja vacío, se usa el texto por defecto según el tipo." />
          <Field
            id="ctaHref"
            label="Destino"
            value={state.ctaHref}
            onChange={(value) => update("ctaHref", value)}
            hint="Ruta interna que empiece por / (ej. /#contacto). No se aceptan URLs externas."
          />
        </div>
      </section>

      {/* --- Publicación y SEO --- */}
      <section className={sectionClass}>
        <h2 className="font-serif text-xl font-light text-foreground">Publicación y SEO</h2>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="sortOrder"
            label="Orden"
            type="number"
            value={String(state.sortOrder)}
            onChange={(value) => update("sortOrder", Number.parseInt(value, 10) || 0)}
            hint="Menor número, antes en el listado público."
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-foreground">
            <Checkbox checked={state.featured} onCheckedChange={(checked) => update("featured", checked === true)} />
            Destacado
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <Checkbox checked={state.isDemo} onCheckedChange={(checked) => update("isDemo", checked === true)} />
            <span>
              Contenido de ejemplo (isDemo)
              <span className="block text-xs text-muted-foreground">
                Se muestra con la etiqueta “Ejemplo ilustrativo” y no se lista en producción salvo que
                ENABLE_DEMO_CONTENT=true.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <Checkbox checked={state.seoNoindex} onCheckedChange={(checked) => update("seoNoindex", checked === true)} />
            <span>
              No indexar (noindex)
              <span className="block text-xs text-muted-foreground">
                Recomendado mientras el contenido sea de ejemplo. Los campos SEO siguen guardándose.
              </span>
            </span>
          </label>
        </div>

        <Field
          id="es-seoTitle"
          label="SEO — título (ES)"
          value={state.translations.es.seoTitle}
          onChange={(value) => updateTranslation("es", "seoTitle", value)}
          hint="Si se deja vacío, se usa el título de la ficha."
        />
        <TextField
          id="es-seoDescription"
          label="SEO — descripción (ES)"
          rows={2}
          value={state.translations.es.seoDescription}
          onChange={(value) => updateTranslation("es", "seoDescription", value)}
        />
        <Field
          id="en-seoTitle"
          label="SEO — título (EN)"
          value={state.translations.en.seoTitle}
          onChange={(value) => updateTranslation("en", "seoTitle", value)}
        />
        <TextField
          id="en-seoDescription"
          label="SEO — descripción (EN)"
          rows={2}
          value={state.translations.en.seoDescription}
          onChange={(value) => updateTranslation("en", "seoDescription", value)}
        />
      </section>
    </form>
  )
}
