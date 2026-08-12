import type { Metadata } from "next"
import { VipStory } from "@/components/vip/vip-story"
import { vipStoryMetadata } from "@/lib/vip/metadata"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return vipStoryMetadata("CATERING_EVENT", slug)
}

export default async function CateringStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <VipStory type="CATERING_EVENT" slug={slug} />
}
