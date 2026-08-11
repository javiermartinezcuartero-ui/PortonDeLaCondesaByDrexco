import Link from "next/link"
import Image from "next/image"
import type { VipStory } from "@/data/vip-stories"

export function StoryCard({ story, basePath }: { story: VipStory; basePath: string }) {
  return (
    <Link href={`${basePath}/${story.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <Image
          src={story.heroImage.src}
          alt={story.heroImage.alt}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        {story.isExample && (
          <span className="absolute top-4 left-4 bg-background/90 px-3 py-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            Ejemplo ilustrativo
          </span>
        )}
      </div>
      <div className="pt-4 space-y-1">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{story.season} · {story.space}</span>
        <h3 className="font-serif text-2xl font-light text-foreground group-hover:text-accent transition-colors duration-300">
          {story.title}
        </h3>
        <p className="text-sm text-muted-foreground italic">{story.subtitle}</p>
      </div>
    </Link>
  )
}
