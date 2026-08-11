import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { weddingStories } from "@/data/vip-stories"
import { EmailGate } from "@/components/vip/email-gate"
import { StoryDetail } from "@/components/vip/story-detail"

export function generateStaticParams() {
  return weddingStories.map((story) => ({ slug: story.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const story = weddingStories.find((item) => item.slug === slug)

  return {
    title: story ? `${story.title} — Boda real` : "Boda real",
    description: story?.subtitle,
    alternates: { canonical: `/bodas-reales/${slug}` },
    // Caso de ejemplo mientras no haya bodas reales publicadas (ver TODO en data/vip-stories.ts).
    robots: { index: false, follow: true },
  }
}

export default async function WeddingStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const story = weddingStories.find((item) => item.slug === slug)

  if (!story) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <EmailGate gateKey="bodas-reales">
        <StoryDetail story={story} backHref="/bodas-reales" kind="bodas" />
      </EmailGate>
    </main>
  )
}
