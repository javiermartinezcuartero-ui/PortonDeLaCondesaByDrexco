import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StoryCard } from "./story-card"
import type { VipStory } from "@/data/vip-stories"

const story: VipStory = {
  slug: "novia-de-prueba",
  isExample: true,
  title: "Novia de prueba",
  subtitle: "Boda de ejemplo",
  season: "Primavera 2026",
  space: "Salón Portón",
  heroImage: { src: "/images/porton/01-boda-civil-jardin.jpg", alt: "Ceremonia de ejemplo" },
  gallery: [],
  providers: [],
  decor: "",
  photocall: "",
  menu: [],
  timing: [],
  surprises: [],
  priceRange: { from: 0, to: 0, currency: "EUR", note: "" },
  weather: "",
  restaurantSolutions: "",
  testimonialQuote: "",
  testimonialAuthor: "",
}

describe("StoryCard", () => {
  it("muestra título, subtítulo y enlace a la ficha", () => {
    render(<StoryCard story={story} basePath="/bodas-reales" />)

    expect(screen.getByText(story.title)).toBeInTheDocument()
    expect(screen.getByText(story.subtitle)).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute("href", `/bodas-reales/${story.slug}`)
  })

  it("marca siempre el contenido de ejemplo como 'Ejemplo ilustrativo'", () => {
    // Regla de negocio no negociable de este proyecto: ninguna ficha VIP de
    // ejemplo puede mostrarse sin esta etiqueta (ver data/vip-stories.ts).
    render(<StoryCard story={story} basePath="/bodas-reales" />)

    expect(screen.getByText("Ejemplo ilustrativo")).toBeInTheDocument()
  })
})
