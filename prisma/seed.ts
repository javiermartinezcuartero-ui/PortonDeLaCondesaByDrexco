/**
 * Seed de desarrollo. NO se ejecuta automáticamente en producción: hay que
 * invocarlo explícitamente (`npm run db:seed`). Crea usuarios ficticios y
 * migra los 6 casos de ejemplo de data/vip-stories.ts a ContentEntry con
 * isDemo=true (ver lib/domain/content.ts sobre ENABLE_DEMO_CONTENT).
 */
import { prisma } from "@/lib/db"
import { createContentEntry, type ContentMediaInput, type ContentProviderInput } from "@/lib/domain/content"
import { weddingStories, cateringStories, type VipStory } from "@/data/vip-stories"
import type { ContentType } from "@prisma/client"

async function seedUsers() {
  const users = [
    { email: "admin@portondelacondesa.dev", name: "Admin de pruebas", role: "ADMIN" as const },
    { email: "comercial@portondelacondesa.dev", name: "Comercial de pruebas", role: "SALES" as const },
    { email: "contenido@portondelacondesa.dev", name: "Editor de contenido de pruebas", role: "CONTENT" as const },
  ]

  const created = []
  for (const user of users) {
    created.push(
      await prisma.user.upsert({
        where: { email: user.email },
        create: { email: user.email, name: user.name, role: user.role, emailVerified: true },
        update: { name: user.name, role: user.role },
      })
    )
  }
  console.log(`Usuarios de desarrollo: ${created.length} (${created.map((u) => u.role).join(", ")})`)
  return created
}

async function seedScoringRules() {
  const rules = [
    { key: "FORM_SUBMITTED", label: "Formulario enviado", points: 10 },
    { key: "PHONE_PROVIDED", label: "Teléfono informado", points: 10 },
    { key: "EVENT_DATE_PROVIDED", label: "Fecha informada", points: 10 },
    { key: "GUEST_COUNT_PROVIDED", label: "Invitados informados", points: 10 },
    { key: "VIP_ACCESS", label: "Acceso VIP", points: 10 },
    { key: "DOSSIER_DOWNLOAD", label: "Descarga de dossier", points: 15 },
    { key: "CONTENT_VIEWED_3PLUS", label: "3 o más reportajes consultados", points: 10 },
    { key: "VISIT_REQUESTED", label: "Solicitud de visita", points: 25 },
  ]

  for (const rule of rules) {
    await prisma.scoringRule.upsert({
      where: { key: rule.key },
      create: rule,
      update: { label: rule.label, points: rule.points },
    })
  }
  console.log(`Reglas de scoring: ${rules.length}`)
}

/** Construye el payload de createContentEntry a partir de una VipStory de ejemplo. */
function toContentEntryInput(story: VipStory, type: ContentType) {
  const media: ContentMediaInput[] = [
    { type: "IMAGE", url: story.heroImage.src, alt: story.heroImage.alt, isHero: true, sortOrder: 0 },
    ...story.gallery.map((item, index) => ({
      type: item.isVideo ? ("EXTERNAL_VIDEO" as const) : ("IMAGE" as const),
      url: item.src,
      alt: item.alt,
      sortOrder: index + 1,
    })),
  ]

  const providers: ContentProviderInput[] = story.providers.map((provider, index) => {
    const mediaIndex = media.length
    media.push({
      type: provider.isVideo ? "EXTERNAL_VIDEO" : "IMAGE",
      url: provider.image.src,
      alt: provider.image.alt,
      sortOrder: mediaIndex,
      // Solo ilustra al proveedor: no debe duplicarse en la galería pública.
      inGallery: false,
    })
    return { category: provider.category, name: provider.name, sortOrder: index, mediaIndex }
  })

  return {
    type,
    slug: story.slug,
    status: "PUBLISHED" as const,
    isDemo: true,
    season: story.season,
    space: story.space,
    decor: story.decor,
    photocall: story.photocall,
    weather: story.weather,
    restaurantSolutions: story.restaurantSolutions,
    testimonialQuote: story.testimonialQuote,
    testimonialAuthor: story.testimonialAuthor,
    priceFrom: story.priceRange.from,
    priceTo: story.priceRange.to,
    priceCurrency: story.priceRange.currency,
    priceNote: story.priceRange.note,
    translations: { es: { title: story.title, subtitle: story.subtitle } },
    media,
    providers,
    menuSections: story.menu.map((course) => ({
      course: course.course,
      items: course.items.map((label) => ({ label })),
    })),
    timeline: story.timing,
    highlights: story.surprises.map((label) => ({ label })),
  }
}

async function seedDemoContent() {
  const entries: Array<{ story: VipStory; type: ContentType }> = [
    ...weddingStories.map((story) => ({ story, type: "REAL_WEDDING" as const })),
    ...cateringStories.map((story) => ({ story, type: "CATERING_EVENT" as const })),
  ]

  let createdCount = 0
  for (const { story, type } of entries) {
    const existing = await prisma.contentEntry.findUnique({ where: { type_slug: { type, slug: story.slug } } })
    if (existing) {
      console.log(`- ${type} "${story.slug}" ya existe, se omite`)
      continue
    }
    await createContentEntry(toContentEntryInput(story, type))
    createdCount++
    console.log(`- ${type} "${story.slug}" creado (isDemo=true)`)
  }
  console.log(`ContentEntry de ejemplo creados: ${createdCount}/${entries.length}`)
}

async function main() {
  await seedUsers()
  await seedScoringRules()
  await seedDemoContent()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
