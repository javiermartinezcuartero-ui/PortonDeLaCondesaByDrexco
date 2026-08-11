import type { Metadata } from "next"
import { weddingStories } from "@/data/vip-stories"
import { StoryCard } from "@/components/vip/story-card"
import { VipListHeader } from "@/components/vip/list-header"

export const metadata: Metadata = {
  title: "Bodas reales",
  description: "Descubre bodas reales celebradas en El Portón de la Condesa: espacios, decoración, gastronomía y opiniones de las parejas.",
  alternates: { canonical: "/bodas-reales" },
  // Contenido de ejemplo mientras no haya casos reales publicados (ver TODO en data/vip-stories.ts).
  robots: { index: false, follow: true },
}

export default function BodasRealesPage() {
  return (
    <main className="min-h-screen bg-background pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <VipListHeader kind="bodas" />

        <div className="grid md:grid-cols-3 gap-10 mt-16">
          {weddingStories.map((story) => (
            <StoryCard key={story.slug} story={story} basePath="/bodas-reales" />
          ))}
        </div>
      </div>
    </main>
  )
}
