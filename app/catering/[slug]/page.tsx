import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cateringStories } from "@/data/vip-stories"
import { EmailGate } from "@/components/vip/email-gate"
import { StoryDetail } from "@/components/vip/story-detail"

export function generateStaticParams() {
  return cateringStories.map((story) => ({ slug: story.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const story = cateringStories.find((item) => item.slug === slug)

  return {
    title: story ? `${story.title} — Catering` : "Catering",
    description: story?.subtitle,
    alternates: { canonical: `/catering/${slug}` },
    // Caso de ejemplo mientras no haya eventos de catering reales publicados (ver TODO en data/vip-stories.ts).
    robots: { index: false, follow: true },
  }
}

export default async function CateringStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const story = cateringStories.find((item) => item.slug === slug)

  if (!story) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <EmailGate gateKey="catering">
        <StoryDetail story={story} backHref="/catering" kind="catering" />
      </EmailGate>
    </main>
  )
}
