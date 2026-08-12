"use client"

import { useEffect, useRef, useState } from "react"
import { ImageReveal } from "@/components/ui/image-reveal"
import { brand, heroContent as heroContentEs } from "@/data/site-content"
import { heroContent as heroContentEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"

export function HeroSection() {
  const { locale } = useLocale()
  const heroContent = locale === "en" ? heroContentEn : heroContentEs
  const [isLoaded, setIsLoaded] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Dispara la transición de entrada tras el primer pintado; no puede
    // hacerse durante el render sin perder el efecto de fade-in. No aplica
    // el React Compiler (no está activado en este proyecto).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoaded(true)

    const handleScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect()
        if (rect.bottom > 0) {
          setScrollY(window.scrollY)
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-end overflow-hidden"
    >
      {/* Background Image with Parallax */}
      <div
        className="absolute inset-0 z-0"
        style={{ transform: `translateY(${scrollY * 0.3}px)` }}
      >
        <ImageReveal
          src={heroContent.image.src}
          alt={heroContent.image.alt}
          priority
          className="object-cover object-center"
          sizes="100vw"
          delay={300}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />
      </div>

      {/* Architectural Grid Lines */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        <div
          className="absolute left-[10%] top-0 w-px h-full bg-foreground/5"
          style={{
            transform: `translateY(${-scrollY * 0.1}px)`,
          }}
        />
        <div
          className="absolute left-[30%] top-0 w-px h-full bg-foreground/5"
          style={{
            transform: `translateY(${-scrollY * 0.15}px)`,
          }}
        />
        <div
          className="absolute right-[20%] top-0 w-px h-full bg-foreground/5"
          style={{
            transform: `translateY(${-scrollY * 0.08}px)`,
          }}
        />
        <div
          className="absolute top-[40%] left-0 w-full h-px bg-foreground/5"
          style={{
            transform: `translateX(${scrollY * 0.05}px)`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 w-full max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20 pb-16 md:pb-24 lg:pb-32">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-end">
          {/* Main Headline */}
          <div className="lg:col-span-8">
            <div className="overflow-hidden">
              <h1
                className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-light leading-[0.9] tracking-[-0.02em] text-foreground pb-[0.15em]"
                style={{
                  transform: isLoaded ? "translateY(0)" : "translateY(100%)",
                  opacity: isLoaded ? 1 : 0,
                  transitionProperty: "all",
                  transitionDuration: "1s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.3s"
                }}
              >
                {heroContent.headlineLines.map((line) => (
                  <span
                    key={line.text}
                    className={line.accent ? "block text-accent italic" : "block text-pretty"}
                  >
                    {line.text}
                  </span>
                ))}
              </h1>
            </div>
          </div>

          {/* Supporting Text */}
          <div className="lg:col-span-4 lg:pb-4">
            <div
              className="space-y-6"
              style={{
                transform: isLoaded ? "translateY(0)" : "translateY(40px)",
                opacity: isLoaded ? 1 : 0,
                transitionProperty: "all",
                transitionDuration: "0.8s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: "0.6s"
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-px bg-accent shrink-0" />
                <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{brand.locationLabel}</span>
              </div>
              <p className="text-base md:text-lg leading-relaxed text-muted-foreground max-w-md">
                {heroContent.supportingText}
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <a
                  href={heroContent.ctaPrimary.href}
                  className="inline-flex items-center gap-3 group text-sm tracking-[0.1em] uppercase text-foreground"
                >
                  <span className="bg-primary my-0 py-3 text-primary-foreground px-6">{heroContent.ctaPrimary.label}</span>
                </a>
                <a
                  href={heroContent.ctaSecondary.href}
                  className="inline-flex items-center gap-2 text-sm tracking-[0.1em] uppercase text-foreground hover:text-accent transition-colors duration-300"
                >
                  {heroContent.ctaSecondary.label}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-3"
          style={{
            opacity: isLoaded ? 1 : 0,
            transitionProperty: "opacity",
            transitionDuration: "1s",
            transitionTimingFunction: "ease",
            transitionDelay: "1.2s"
          }}
        >
          <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-foreground/40 to-transparent relative overflow-hidden">
            <div className="absolute inset-0 w-full bg-accent animate-pulse" style={{ animation: "scrollPulse 2s ease-in-out infinite" }} />
          </div>
        </div>
      </div>

      {/* Corner Decorative Element */}
      <div
        className="absolute top-32 right-6 md:right-12 lg:right-20 z-20 hidden md:block"
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateX(0)" : "translateX(20px)",
          transitionProperty: "all",
          transitionDuration: "0.8s",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          transitionDelay: "0.9s"
        }}
      >
        <a
          href="#mapa"
          className="flex items-center gap-4 text-xs tracking-[0.2em] uppercase text-foreground bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-sm hover:text-accent transition-colors duration-300"
        >
          <span>{brand.coordinates.label}</span>
        </a>
      </div>

      <style jsx>{`
        @keyframes scrollPulse {
          0%, 100% { transform: translateY(-100%); }
          50% { transform: translateY(100%); }
        }
      `}</style>
    </section>
  )
}
