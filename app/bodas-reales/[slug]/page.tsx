import type { Metadata } from "next"
import { VipStory } from "@/components/vip/vip-story"
import { vipStoryMetadata } from "@/lib/vip/metadata"

/**
 * Sin `generateStaticParams`: los slugs los decide ahora el CMS, no un array
 * en el repositorio. Pregenerarlos daría una lista congelada en el momento del
 * build (obsoleta en cuanto se publica o despublica algo) y además esta página
 * no puede ser estática, porque depende de la cookie de acceso VIP.
 */
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return vipStoryMetadata("REAL_WEDDING", slug)
}

export default async function WeddingStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <VipStory type="REAL_WEDDING" slug={slug} />
}
