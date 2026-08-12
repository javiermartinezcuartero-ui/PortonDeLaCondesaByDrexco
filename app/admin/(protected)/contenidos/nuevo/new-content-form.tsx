"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { slugify } from "@/lib/slug"
import { createContentEntryAction } from "../actions"

export function NewContentForm() {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string[]>([])
  const [type, setType] = useState<"REAL_WEDDING" | "CATERING_EVENT">("REAL_WEDDING")
  const [title, setTitle] = useState("")
  // El slug se sugiere a partir del título, pero es editable: en cuanto se
  // toca a mano, deja de seguir al título.
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)

  const effectiveSlug = slugTouched ? slug : slugify(title)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setErrors([])
    startTransition(async () => {
      // Si tiene éxito, la acción hace `redirect` y no vuelve.
      const result = await createContentEntryAction({ type, slug: effectiveSlug, title })
      if (result && !result.ok) setErrors(result.errors)
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Tipo</legend>
        <div className="flex gap-6 pt-1">
          {(
            [
              { value: "REAL_WEDDING", label: "Boda real" },
              { value: "CATERING_EVENT", label: "Evento de catering" },
            ] as const
          ).map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="type"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="title" className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
          Título en español
        </label>
        <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="slug" className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
          Slug
        </label>
        <Input
          id="slug"
          value={effectiveSlug}
          onChange={(event) => {
            setSlugTouched(true)
            setSlug(event.target.value)
          }}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Se sugiere a partir del título. Solo minúsculas, números y guiones; se valida también en servidor.
        </p>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="px-6 py-3 text-sm tracking-[0.1em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300 disabled:opacity-60"
      >
        {isPending ? "Creando…" : "Crear borrador"}
      </button>
    </form>
  )
}
