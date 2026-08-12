import { z } from "zod"

/**
 * Validación del editor de contenidos. Se aplica **en servidor** dentro de
 * cada Server Action (`app/admin/(protected)/contenidos/actions.ts`): la
 * validación del formulario en el navegador es una ayuda de usabilidad, no
 * una garantía.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slugSchema = z
  .string()
  .trim()
  .min(3, "El slug debe tener al menos 3 caracteres")
  .max(100, "El slug no puede superar los 100 caracteres")
  .regex(SLUG_PATTERN, "Solo minúsculas, números y guiones simples (sin acentos, espacios ni guiones al inicio/final)")

export const contentTypeSchema = z.enum(["REAL_WEDDING", "CATERING_EVENT"])

/** Convierte "" en undefined: un campo de texto vacío es "sin valor", no una cadena vacía. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))

const translationSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  subtitle: optionalText(300),
  intro: optionalText(2000),
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),
})

/**
 * La traducción inglesa es opcional en bloque. Si se rellena cualquier campo
 * pero no el título, es un error del editor (no una traducción vacía): sin
 * título no es una traducción utilizable.
 */
const optionalTranslationSchema = z
  .object({
    title: optionalText(200),
    subtitle: optionalText(300),
    intro: optionalText(2000),
    seoTitle: optionalText(160),
    seoDescription: optionalText(320),
  })
  .optional()
  .superRefine((value, ctx) => {
    if (!value) return
    const hasContent = Boolean(value.subtitle || value.intro || value.seoTitle || value.seoDescription)
    if (hasContent && !value.title) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Si rellenas la versión inglesa, el título en inglés es obligatorio",
      })
    }
  })

/** Fecha en formato `yyyy-mm-dd` de un `<input type="date">`. */
const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha no válido")
  .optional()
  .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : undefined))

const optionalIntSchema = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return undefined
    const parsed = typeof value === "number" ? value : Number(value)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
  })
  .refine((value) => value === undefined || value >= 0, "No puede ser negativo")

/** Solo rutas internas: un CTA no debe poder llevar al visitante fuera del sitio. */
const internalHrefSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine(
    (value) => value === undefined || (value.startsWith("/") && !value.startsWith("//")),
    "El destino del CTA debe ser una ruta interna que empiece por / (no una URL externa)"
  )

export const createContentEntrySchema = z.object({
  type: contentTypeSchema,
  slug: slugSchema,
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
})

export type CreateContentEntryValues = z.infer<typeof createContentEntrySchema>

export const saveContentEntrySchema = z.object({
  id: z.string().min(1),
  /** ISO string del `updatedAt` que tenía la ficha al abrir el editor. */
  expectedUpdatedAt: z.string().datetime(),
  type: contentTypeSchema,
  slug: slugSchema,
  isDemo: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  seoNoindex: z.boolean(),
  eventDate: dateStringSchema,
  season: optionalText(120),
  space: optionalText(200),
  decor: optionalText(2000),
  photocall: optionalText(2000),
  weather: optionalText(1000),
  restaurantSolutions: optionalText(2000),
  testimonialQuote: optionalText(1000),
  testimonialAuthor: optionalText(200),
  priceFrom: optionalIntSchema,
  priceTo: optionalIntSchema,
  priceCurrency: optionalText(8),
  priceNote: optionalText(500),
  ctaLabel: optionalText(120),
  ctaHref: internalHrefSchema,
  translations: z.object({ es: translationSchema, en: optionalTranslationSchema }),
  media: z
    .array(
      z.object({
        id: z.string().min(1),
        alt: optionalText(300),
        caption: optionalText(300),
        sortOrder: z.number().int().min(0),
        isHero: z.boolean(),
        inGallery: z.boolean(),
      })
    )
    .max(60, "Máximo 60 archivos por ficha"),
  providers: z
    .array(
      z.object({
        category: z.string().trim().min(1, "La categoría del proveedor es obligatoria").max(120),
        name: z.string().trim().min(1, "El nombre del proveedor es obligatorio").max(200),
        mediaId: z
          .string()
          .optional()
          .transform((value) => (value ? value : undefined)),
      })
    )
    .max(30),
  menuSections: z
    .array(
      z.object({
        course: z.string().trim().min(1, "El nombre del pase es obligatorio").max(160),
        items: z.array(z.string().trim().min(1).max(300)).max(30),
      })
    )
    .max(15),
  timeline: z
    .array(
      z.object({
        time: z.string().trim().min(1, "La hora es obligatoria").max(20),
        moment: z.string().trim().min(1, "La descripción del momento es obligatoria").max(300),
      })
    )
    .max(40),
  highlights: z.array(z.string().trim().min(1).max(500)).max(30),
})

export type SaveContentEntryValues = z.infer<typeof saveContentEntrySchema>

/** Comprobaciones que cruzan varios campos y no encajan en un `.refine` de campo. */
export function validateSaveConsistency(values: SaveContentEntryValues): string[] {
  const errors: string[] = []

  if (values.priceFrom !== undefined && values.priceTo !== undefined && values.priceFrom > values.priceTo) {
    errors.push("El presupuesto mínimo no puede ser mayor que el máximo.")
  }

  const heroCount = values.media.filter((media) => media.isHero).length
  if (heroCount > 1) {
    errors.push("Solo puede haber una imagen principal (hero).")
  }

  const emptyMenuSections = values.menuSections.filter((section) => section.items.length === 0)
  if (emptyMenuSections.length) {
    errors.push("Hay pases de la minuta sin ningún plato.")
  }

  return errors
}

export const externalMediaSchema = z.object({
  contentEntryId: z.string().min(1),
  type: z.enum(["EXTERNAL_VIDEO", "REEL"]),
  url: z.string().trim().min(1, "La URL del vídeo es obligatoria"),
  thumbnailUrl: z.string().trim().min(1, "La miniatura es obligatoria"),
  alt: optionalText(300),
  caption: optionalText(300),
})
