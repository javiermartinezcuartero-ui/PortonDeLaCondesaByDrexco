"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { brand, navigation as navigationEs, headerCta as headerCtaEs } from "@/data/site-content"
import { navigation as navigationEn, headerCta as headerCtaEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"
import { AdminAccess } from "@/components/admin-access"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { locale, toggleLocale } = useLocale()
  const navigation = locale === "en" ? navigationEn : navigationEs
  const headerCta = locale === "en" ? headerCtaEn : headerCtaEs

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out",
        isScrolled
          // Cristal, como la tarjeta de la pantalla de acceso: el fondo baja del
          // 95 % al 72 % de opacidad y el desenfoque sube de `sm` a `xl`, así que
          // la fotografía y las secciones se adivinan difuminadas al pasar por
          // debajo en vez de desaparecer tras una barra plana. La sombra baja y muy
          // difusa es lo que despega la cabecera del contenido; sin ella, con el
          // fondo translúcido, la cabecera y la página se leen como un solo plano.
          //
          // `header-solid` sigue puesto: le dice al botón del panel que lo que hay
          // detrás ya es claro, y que cambie su anillo blanco por uno de marca (ver
          // `.admin-access-fab` en app/globals.css).
          ? "header-solid bg-background/72 backdrop-blur-xl border-b border-border/70 shadow-[0_10px_40px_-24px_rgba(24,38,5,0.45)]"
          // Sin scroll el header va sobre la fotografía del hero, y ahí estaba el
          // problema: los enlaces son texto pequeño en mayúsculas sobre una imagen
          // con zonas claras y oscuras, así que no había contraste fiable en
          // ninguna. Un degradado desde arriba les da base sin tapar la foto ni
          // convertir la cabecera en una barra sólida, que es lo que el diseño
          // evita a propósito en la portada.
          : "bg-gradient-to-b from-background/72 via-background/28 to-transparent"
      )}
    >
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="flex items-center justify-between h-20 md:h-24">
          {/* Logo */}
          <Link
            href="/"
            className="relative group shrink-0"
            aria-label={brand.name}
          >
            {/* El logotipo se pinta como una máscara sobre el verde de marca, así
                que hereda su problema: `#182605` es casi negro y sobre la
                fotografía del hero pierde definición. La sombra proyectada muy
                suave lo despega del fondo sin alterar su color, y es lo que le da
                presencia al tamaño nuevo —de 36/44 px a 44/56— sin convertirlo en
                una mancha. `drop-shadow` y no `box-shadow`: con máscara, la sombra
                tiene que seguir la silueta de las letras, no el rectángulo. */}
            <span
              role="img"
              aria-label={brand.name}
              // `header-logo` no da estilo aquí: es el asidero con el que las
              // bibliotecas VIP le cambian el color, porque sobre su fondo oscuro el
              // verde de marca se pierde (ver app/globals.css).
              className="header-logo block h-11 md:h-14 bg-primary [filter:drop-shadow(0_1px_2px_oklch(1_0_0/45%))_drop-shadow(0_6px_14px_oklch(0_0_0/28%))]"
              style={{
                aspectRatio: "3344 / 852",
                WebkitMaskImage: `url(${brand.logo.transparent})`,
                maskImage: `url(${brand.logo.transparent})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskPosition: "left center",
                maskPosition: "left center",
              }}
            />
          </Link>

          {/* Desktop Navigation */}
          {/*
            El nombre accesible no es decorativo: en cualquier página hay tres
            landmarks de navegación a la vez (esta o la del menú móvil, más las dos
            del pie). Sin nombre, un lector de pantalla los lista como tres
            entradas "navegación" idénticas y hay que entrar en cada una para saber
            cuál es. Navegar por landmarks es además la forma de saltarse la
            cabecera, así que es justo el público que necesita distinguirlos.
          */}
          <nav aria-label={locale === "en" ? "Main" : "Principal"} className="hidden xl:flex items-center gap-5 2xl:gap-8">
            {navigation.map((item) =>
              item.highlight ? (
                // Pastilla de color: sin el subrayado animado, que en un botón no
                // significa nada, y con `text-white` fijo porque el degradado es
                // oscuro en los tres tramos y no cambia con el tema.
                // Botón de color. La forma, el tamaño y el degradado los define
                // `.nav-cta` en app/globals.css, con una variante por biblioteca:
                // aquí no se repite ninguna medida para que haya un solo sitio donde
                // ajustarlas.
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn("nav-cta shrink-0 whitespace-nowrap", `nav-cta--${item.highlight}`)}
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="relative group shrink-0 whitespace-nowrap text-[13px] font-medium tracking-[0.08em] uppercase text-foreground/90 hover:text-foreground transition-colors duration-300"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-px bg-accent transition-all duration-300 group-hover:w-full" />
                </Link>
              )
            )}
          </nav>

          {/* Language toggle */}
          <label className="hidden xl:flex items-center gap-2 shrink-0 cursor-pointer select-none">
            <span className={cn("text-xs font-medium tracking-[0.1em]", locale === "es" ? "text-foreground" : "text-foreground/55")}>ES</span>
            <span className="relative inline-flex h-4 w-8 items-center rounded-full bg-border transition-colors">
              <input
                type="checkbox"
                checked={locale === "en"}
                onChange={toggleLocale}
                className="peer sr-only"
                aria-label="Switch language / Cambiar idioma"
              />
              <span
                className={cn(
                  "absolute left-0.5 h-3 w-3 rounded-full bg-primary transition-transform duration-300",
                  locale === "en" && "translate-x-4"
                )}
              />
            </span>
            <span className={cn("text-xs font-medium tracking-[0.1em]", locale === "en" ? "text-foreground" : "text-foreground/55")}>EN</span>
          </label>

          {/* Acceso al panel privado. El CTA de contacto se retiró de la barra
              superior; sigue disponible en el menú móvil y en la home. */}
          <div className="hidden xl:flex items-center shrink-0">
            <AdminAccess />
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="xl:hidden relative w-10 h-10 flex items-center justify-center"
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMobileMenuOpen}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className={cn(
                  "w-6 h-px bg-foreground transition-all duration-300",
                  isMobileMenuOpen && "rotate-45 translate-y-[4px]"
                )}
              />
              <span
                className={cn(
                  "w-6 h-px bg-foreground transition-all duration-300",
                  isMobileMenuOpen && "-rotate-45 -translate-y-[3px]"
                )}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {/*
        `inert` cuando está cerrado, y no basta con `opacity-0 pointer-events-none`.
        Ninguna de esas dos clases saca nada del árbol de accesibilidad ni del orden
        de tabulación: con el menú cerrado en móvil o tableta, pulsar Tab desde el
        botón de hamburguesa metía el foco en ocho controles completamente
        invisibles —los enlaces de navegación, el CTA, el conmutador de idioma y el
        acceso al panel—, sin anillo de foco visible en ninguna parte y con Enter
        navegando a donde nadie había pedido.

        `inert` retira el subárbol entero de golpe y deja intacta la animación de
        opacidad, que es la razón por la que el bloque no se desmonta.
      */}
      <div
        inert={!isMobileMenuOpen}
        className={cn(
          // `header-solid` también aquí: el panel desplegado es un fondo claro
          // opaco, igual que la cabecera con scroll.
          "header-solid xl:hidden fixed inset-0 bg-background transition-all duration-500 ease-out",
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ top: isScrolled ? "81px" : "80px" }}
      >
        <nav
          aria-label={locale === "en" ? "Mobile menu" : "Menú"}
          className="flex flex-col items-center justify-center h-full gap-8 pb-20"
        >
          {navigation.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "transition-colors duration-300",
                item.highlight
                  // En el menú desplegado los botones se ensanchan —hay sitio de
                  // sobra— pero conservan alto, cuerpo y color de `.nav-cta`: son el
                  // mismo elemento, no una variante para móvil.
                  ? cn("nav-cta px-8", `nav-cta--${item.highlight}`)
                  : "text-2xl font-serif tracking-[0.1em] text-foreground hover:text-accent"
              )}
              style={{
                transitionDelay: isMobileMenuOpen ? `${index * 50}ms` : "0ms",
                transform: isMobileMenuOpen ? "translateY(0)" : "translateY(20px)",
                opacity: isMobileMenuOpen ? 1 : 0,
                transition: "all 0.5s ease-out"
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={headerCta.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className="mt-8 px-8 py-4 text-sm tracking-[0.1em] uppercase text-primary-foreground bg-primary"
            style={{
              transitionDelay: isMobileMenuOpen ? `${navigation.length * 50}ms` : "0ms",
              transform: isMobileMenuOpen ? "translateY(0)" : "translateY(20px)",
              opacity: isMobileMenuOpen ? 1 : 0,
              transition: "all 0.5s ease-out"
            }}
          >
            {headerCta.label}
          </Link>
          <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
            <span className={cn("text-xs font-medium tracking-[0.1em]", locale === "es" ? "text-foreground" : "text-foreground/55")}>ES</span>
            <span className="relative inline-flex h-4 w-8 items-center rounded-full bg-border">
              <input type="checkbox" checked={locale === "en"} onChange={toggleLocale} className="peer sr-only" aria-label="Switch language / Cambiar idioma" />
              <span className={cn("absolute left-0.5 h-3 w-3 rounded-full bg-primary transition-transform duration-300", locale === "en" && "translate-x-4")} />
            </span>
            <span className={cn("text-xs font-medium tracking-[0.1em]", locale === "en" ? "text-foreground" : "text-foreground/55")}>EN</span>
          </label>

          {/* El mismo acceso, para que en móvil no quede fuera de alcance */}
          <div onClick={() => setIsMobileMenuOpen(false)}>
            <AdminAccess />
          </div>
        </nav>
      </div>
    </header>
  )
}
