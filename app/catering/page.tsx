import type { Metadata } from "next"
import { cateringStories } from "@/data/vip-stories"
import { StoryCard } from "@/components/vip/story-card"
import { VipListHeader } from "@/components/vip/list-header"

export const metadata: Metadata = {
  title: "Catering",
  description: "Descubre eventos de catering realizados por El Portón de la Condesa: montajes, menús y opiniones de nuestros clientes.",
  alternates: { canonical: "/catering" },
  // Contenido de ejemplo mientras no haya casos reales publicados (ver TODO en data/vip-stories.ts).
  robots: { index: false, follow: true },
}

export default function CateringPage() {
  return (
    <main className="min-h-screen bg-background pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <VipListHeader kind="catering" />

        <div className="grid md:grid-cols-3 gap-10 mt-16">
          {cateringStories.map((story) => (
            <StoryCard key={story.slug} story={story} basePath="/catering" />
          ))}
        </div>
      </div>
    </main>
  )
}
