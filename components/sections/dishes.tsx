"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ImageReveal } from "@/components/ui/image-reveal"
import { gastronomyContent as gastronomyContentEs } from "@/data/site-content"
import { gastronomyContent as gastronomyContentEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"

export function DishesSection() {
  const { locale } = useLocale()
  const gastronomyContent = locale === "en" ? gastronomyContentEn : gastronomyContentEs
  const [isVisible, setIsVisible] = useState(false)
  const [activePillar, setActivePillar] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const pillars = gastronomyContent.pillars

  return (
    <section
      ref={sectionRef}
      id="gastronomia"
      className="relative py-32 md:py-48 overflow-hidden bg-secondary"
    >
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        {/* Section Header */}
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-20 mb-20 md:mb-32">
          <div className="lg:col-span-2">
            <div
              className="flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">(05)</span>
              <div className="w-8 h-px bg-border" />
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">{gastronomyContent.label}</span>
            </div>
          </div>

          <div className="lg:col-span-10">
            <h2
              className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-[1.1] tracking-[-0.01em] text-foreground max-w-4xl text-pretty"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(40px)",
                transitionProperty: "all",
                transitionDuration: "0.8s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: "0.1s"
              }}
            >
              {gastronomyContent.title}
            </h2>
          </div>
        </div>

        {/* Pillars Showcase */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Main Image */}
          <div className="lg:col-span-8 relative">
            <div className="relative aspect-[4/3] overflow-hidden bg-background">
              {pillars.map((pillar, index) => (
                <div
                  key={pillar.id}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: activePillar === index ? 1 : 0 }}
                >
                  {activePillar === index ? (
                    <ImageReveal
                      src={pillar.image.src}
                      alt={pillar.image.alt}
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority={index === 0}
                      delay={300}
                    />
                  ) : (
                    <Image
                      src={pillar.image.src}
                      alt={pillar.image.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority={index === 0}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pillar Info Cards */}
          <div className="lg:col-span-4 space-y-4">
            {pillars.map((pillar, index) => (
              <button
                key={pillar.id}
                type="button"
                onClick={() => setActivePillar(index)}
                className={`w-full text-left p-6 md:p-8 transition-all duration-500 ${
                  activePillar === index
                    ? "bg-background"
                    : "bg-background/50 hover:bg-background/70"
                }`}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(30px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: `${0.2 + index * 0.1}s`
                }}
              >
                <div className="space-y-4">
                  {/* Pillar Name */}
                  <div>
                    <h3 className="font-serif text-2xl md:text-3xl font-light text-foreground mb-1">
                      {pillar.name}
                    </h3>
                    <p className="text-sm text-muted-foreground italic">
                      {pillar.subtitle}
                    </p>
                  </div>

                  {/* Description - Only show for active pillar */}
                  <div
                    className="overflow-hidden transition-all duration-500"
                    style={{
                      maxHeight: activePillar === index ? "300px" : "0",
                      opacity: activePillar === index ? 1 : 0
                    }}
                  >
                    <div className="space-y-4 pt-2">
                      <p className="text-sm leading-relaxed text-foreground/70">
                        {pillar.description}
                      </p>
                    </div>
                  </div>

                  {/* Indicator */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border" />
                    <div
                      className={`w-2 h-2 transition-all duration-500 ${
                        activePillar === index ? "bg-accent scale-125" : "bg-border"
                      }`}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Note */}
        <div
          className="mt-16 md:mt-24 text-center"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transitionProperty: "all",
            transitionDuration: "0.8s",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            transitionDelay: "0.6s"
          }}
        >
          <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto leading-relaxed">
            {gastronomyContent.note}
          </p>
        </div>
      </div>
    </section>
  )
}
