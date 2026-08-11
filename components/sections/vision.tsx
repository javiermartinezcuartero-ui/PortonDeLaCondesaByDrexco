"use client"

import { useEffect, useRef, useState } from "react"
import { visionContent as visionContentEs } from "@/data/site-content"
import { visionContent as visionContentEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"

export function VisionSection() {
  const { locale } = useLocale()
  const visionContent = locale === "en" ? visionContentEn : visionContentEs
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.2 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="vision"
      className="relative py-32 md:py-48 lg:py-64 overflow-hidden"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden text-foreground">
        <svg
          className="absolute -top-[10%] -right-[10%] w-[70%] h-[70%] md:w-[55%] md:h-[55%]"
          viewBox="0 0 600 600"
          fill="none"
        >
          <circle
            cx="300"
            cy="300"
            r="299"
            stroke="currentColor"
            strokeWidth="1"
            className="opacity-[0.05]"
            style={{
              strokeDasharray: 1880,
              strokeDashoffset: isVisible ? 0 : 1880,
              transition: "stroke-dashoffset 2.4s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
          <circle
            cx="300"
            cy="300"
            r="220"
            stroke="currentColor"
            strokeWidth="1"
            className="opacity-[0.04]"
            style={{
              strokeDasharray: 1382,
              strokeDashoffset: isVisible ? 0 : 1382,
              transition: "stroke-dashoffset 2.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
            }}
          />
        </svg>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <line
            x1="0%" y1="100%" x2="45%" y2="0%"
            stroke="currentColor"
            strokeWidth="1"
            className="opacity-[0.04]"
            style={{
              strokeDasharray: 1600,
              strokeDashoffset: isVisible ? 0 : 1600,
              transition: "stroke-dashoffset 2.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s",
            }}
          />
        </svg>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-20">
          {/* Section Label */}
          <div className="lg:col-span-2">
            <div
              className="flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">(01)</span>
              <div className="w-8 h-px bg-border" />
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">{visionContent.label}</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-10">
            <div className="space-y-16 md:space-y-24">
              {/* Large Statement */}
              <div className="overflow-hidden">
                <h2
                  className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-light leading-[1.1] tracking-[-0.01em] text-foreground max-w-5xl text-pretty"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(60px)",
                    transitionProperty: "all",
                    transitionDuration: "1s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.1s"
                  }}
                >
                  {visionContent.statement}
                </h2>
              </div>

              {/* Supporting Content */}
              <div className="grid md:grid-cols-2 gap-12 md:gap-20">
                {visionContent.paragraphs.map((paragraph, index) => (
                  <div
                    key={paragraph}
                    className="space-y-6"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateY(0)" : "translateY(40px)",
                      transitionProperty: "all",
                      transitionDuration: "0.8s",
                      transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                      transitionDelay: `${0.3 + index * 0.1}s`
                    }}
                  >
                    <p className="text-lg md:text-xl leading-relaxed text-foreground/80">
                      {paragraph}
                    </p>
                  </div>
                ))}
              </div>

              {/* Highlights */}
              <div
                className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 pt-8 border-t border-border"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(30px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.5s"
                }}
              >
                {visionContent.highlights.map((item) => {
                  const isNumeric = /^\d+\+?$/.test(item.value)
                  return (
                    <div key={item.label} className="my-0 space-x-0 leading-5">
                      <span
                        className={
                          isNumeric
                            ? "text-3xl md:text-4xl lg:text-6xl font-light text-foreground font-sans"
                            : "text-xl md:text-2xl lg:text-3xl font-light text-foreground font-sans"
                        }
                      >
                        {item.value}
                      </span>
                      <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Line */}
      <div
        className="absolute bottom-0 left-6 md:left-12 lg:left-20 right-6 md:right-12 lg:right-20 h-px bg-border"
        style={{
          transform: isVisible ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          transitionProperty: "transform",
          transitionDuration: "1.5s",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          transitionDelay: "0.6s"
        }}
      />
    </section>
  )
}
