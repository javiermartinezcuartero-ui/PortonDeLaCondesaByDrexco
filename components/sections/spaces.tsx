"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ImageReveal } from "@/components/ui/image-reveal"
import { spacesContent, spacesSectionContent as spacesSectionContentEs } from "@/data/site-content"
import { spacesSectionContent as spacesSectionContentEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"

export function SpacesSection() {
  const { locale } = useLocale()
  const spacesSectionContent = locale === "en" ? spacesSectionContentEn : spacesSectionContentEs
  const [isVisible, setIsVisible] = useState(false)
  const [activeSpace, setActiveSpace] = useState(0)
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

  const spaces = spacesContent
  const current = spaces[activeSpace]

  return (
    <section
      ref={sectionRef}
      id="espacios"
      className="relative py-32 md:py-48 overflow-hidden"
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
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">(04)</span>
              <div className="w-8 h-px bg-border" />
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">{spacesSectionContent.label}</span>
            </div>
          </div>

          <div className="lg:col-span-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <h2
                className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-[1.1] tracking-[-0.01em] text-foreground max-w-2xl text-pretty"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(40px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.1s"
                }}
              >
                {spacesSectionContent.title}
              </h2>
              <a
                href={spacesSectionContent.cta.href}
                className="inline-flex items-center gap-3 text-sm tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300 group"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.2s"
                }}
              >
                <span>{spacesSectionContent.cta.label}</span>
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Featured Space Display */}
        <div
          className="grid lg:grid-cols-12 gap-8 lg:gap-12"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(40px)",
            transitionProperty: "all",
            transitionDuration: "0.8s",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            transitionDelay: "0.3s"
          }}
        >
          {/* Main Image */}
          <div className="lg:col-span-8 relative">
            <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
              {spaces.map((space, index) => (
                <div
                  key={space.slug}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: activeSpace === index ? 1 : 0 }}
                >
                  {activeSpace === index ? (
                    <ImageReveal
                      src={space.image.src}
                      alt={space.image.alt}
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority={index === 0}
                      delay={300}
                    />
                  ) : (
                    <Image
                      src={space.image.src}
                      alt={space.image.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority={index === 0}
                    />
                  )}
                </div>
              ))}

              {/* Image Overlay Info */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 bg-gradient-to-t from-primary/90 to-transparent">
                <div className="text-primary-foreground">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-xs tracking-[0.2em] uppercase opacity-70">
                      {current.type}
                    </span>
                  </div>
                  <h3 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light">
                    {current.name}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Space Info */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            {/* Description */}
            <div className="space-y-6 mb-8 lg:mb-0">
              <p className="text-muted-foreground leading-relaxed">
                {current.description}
              </p>

              {/* Features */}
              <div className="space-y-3">
                <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{locale === "en" ? "Features" : "Características"}</span>
                <ul className="space-y-2">
                  {current.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-foreground/80">
                      <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended for */}
              <div className="space-y-3">
                <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{locale === "en" ? "Recommended for" : "Recomendado para"}</span>
                <div className="flex flex-wrap gap-2">
                  {current.recommendedFor.map((use) => (
                    <span key={use} className="text-xs px-3 py-1 border border-border text-foreground/70">
                      {use}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Space Navigation */}
            <div className="space-y-4 pt-8 border-t border-border">
              {spaces.map((space, index) => (
                <button
                  key={space.slug}
                  type="button"
                  onClick={() => setActiveSpace(index)}
                  className={`w-full text-left py-3 px-4 transition-all duration-300 ${
                    activeSpace === index
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs opacity-50">0{index + 1}</span>
                      <span className="font-serif text-lg">{space.name}</span>
                    </div>
                    <svg
                      className={`w-4 h-4 transition-transform duration-300 ${
                        activeSpace === index ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
