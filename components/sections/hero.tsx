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
      // Por encima de la pantalla completa en escritorio. El recorrido fue: 100vh →
      // 88vh para acortar la página → 100vh otra vez porque el contenido quedaba
      // apretado → y ahora 112vh, que es lo que se pidió para darle aire de verdad.
      // Que sobrepase el alto del viewport es intencionado: la fotografía continúa
      // por debajo del pliegue e invita a bajar.
      //
      // En móvil se queda en pantalla completa. Un 112vh en un teléfono es una
      // fotografía que no cabe entera de ninguna manera, y obligaría a desplazarse
      // solo para llegar a leer el titular.
      //
      // `hero-brand-text` cambia el texto del casi negro al verde de marca; el motivo
      // está en app/globals.css.
      className="hero-brand-text relative min-h-screen md:min-h-[112vh] flex items-end overflow-hidden"
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
          // La fotografía original está muy quemada: el cielo y el toldo blanco
          // se comían el contraste del titular. Se baja la luminosidad y se sube
          // ligeramente el contraste sobre la propia imagen, en vez de añadir una
          // capa oscura encima, para no alterar los dos degradados que vienen
          // después ni el tono cálido del jardín.
          className="object-cover object-center brightness-[0.62] contrast-[1.16] saturate-[1.08]"
          sizes="100vw"
          delay={300}
        />
        {/* Los dos velos crema que aclaran los bordes —el «efecto viñeta»—.
            No se pueden quitar: el titular es texto **oscuro** sobre la
            fotografía, y son ellos los que le dan base. Lo que se hace es
            concentrarlos donde el texto está y retirarlos del resto.

            El de abajo mantiene el crema opaco en el borde inferior, que es lo
            que funde el hero con la sección siguiente, y su parada intermedia
            baja del 32 % al 26 %. El lateral es el que más se recorta —del 48 %
            al 22 %, y cortado al 30 % en vez de recorrer todo el ancho—, porque
            era el que velaba el lado izquierdo de arriba abajo.

            El 26 % de la parada intermedia está medido, no elegido a ojo: con el
            16 % que se probó primero, la etiqueta de localización —12 px sobre la
            zona de follaje— caía a 2,37:1 y quedaba por debajo del 4,5:1 de la
            WCAG. Es el suelo por debajo del cual no se puede bajar mientras el
            texto del hero sea oscuro. */}
        {/* En móvil la parada intermedia sube del 26 % al 46 %. No es un ajuste a
            ojo: en un viewport estrecho y alto el titular queda más arriba en el
            encuadre, sobre la zona de sombra de la pérgola, y con el 26 % de
            escritorio el fondo bajo el titular se quedaba en 1,47:1 —las letras se
            empastaban de verdad—. Con el 46 % sube a 3,4:1, que es el mínimo de la
            WCAG para texto grande, y el titular no baja de 48 px en ningún tamaño.
            En escritorio se mantiene el valor original, ya medido contra la etiqueta
            de localización. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background from-[6%] via-background/46 via-[58%] md:via-background/26 md:via-[52%] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/22 via-transparent via-[30%] to-transparent" />
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
                {/* Con la fotografía más oscura, esta etiqueta —12 px, el texto más
                    pequeño del hero— se quedaba en 4,35:1 sobre la zona de follaje,
                    por debajo del 4,5:1 de la WCAG. En vez de volver a subir el velo
                    de toda la imagen por un elemento, se le da base propia: es el
                    mismo recurso que ya usa la etiqueta de coordenadas de la esquina
                    de este hero, así que no introduce un patrón nuevo. */}
                <span className="text-xs tracking-[0.2em] uppercase text-foreground bg-background/85 backdrop-blur-sm px-2.5 py-1 rounded-sm">
                  {brand.locationLabel}
                </span>
              </div>
              {/* Este párrafo va sobre la fotografía, no sobre una superficie plana, y
                  eso cambia lo que necesita: color a plena opacidad —el 80 % que tenía
                  lo dejaba lavado sobre las zonas claras— y peso 500 en lugar de 400,
                  porque un trazo fino sobre textura fotográfica se rompe aunque el
                  contraste medido dé de sobra. `text-muted-foreground` queda descartado
                  por lo mismo: es un gris pensado para fondos lisos. El cuerpo no
                  cambia, y el halo crema que se probó aquí se retiró junto con el del
                  titular (ver app/globals.css): emborronaba en lugar de separar. */}
              <p className="text-base md:text-lg font-medium leading-relaxed text-foreground max-w-md">
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
