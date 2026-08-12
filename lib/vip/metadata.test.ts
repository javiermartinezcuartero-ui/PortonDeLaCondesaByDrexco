import { describe, expect, it } from "vitest"
import sitemap from "@/app/sitemap"
import { vipLibraryMetadata, vipStoryMetadata } from "@/lib/vip/metadata"

describe("metadata de las bibliotecas VIP", () => {
  it.each(["REAL_WEDDING", "CATERING_EVENT"] as const)("%s es noindex mientras el contenido esté cerrado", (type) => {
    const metadata = vipLibraryMetadata(type)
    expect(metadata.robots).toMatchObject({ index: false })
  })

  it("el canonical apunta a la ruta de la biblioteca", () => {
    expect(vipLibraryMetadata("REAL_WEDDING").alternates?.canonical).toBe("/bodas-reales")
    expect(vipLibraryMetadata("CATERING_EVENT").alternates?.canonical).toBe("/catering")
  })

  it("el canonical de una ficha incluye su slug", () => {
    expect(vipStoryMetadata("REAL_WEDDING", "laura-y-marcos").alternates?.canonical).toBe(
      "/bodas-reales/laura-y-marcos"
    )
    expect(vipStoryMetadata("CATERING_EVENT", "gala-empresa").alternates?.canonical).toBe("/catering/gala-empresa")
  })

  it("una ficha también es noindex", () => {
    expect(vipStoryMetadata("REAL_WEDDING", "laura-y-marcos").robots).toMatchObject({ index: false })
  })

  it("no filtra el título real de la ficha: usa un título genérico de sección", () => {
    // Construir el título desde la base de datos obligaría a leer la ficha
    // antes de validar el acceso. El slug sí aparece en el canonical, pero eso
    // no revela nada: es la URL que el propio visitante ha pedido.
    const metadata = vipStoryMetadata("REAL_WEDDING", "laura-y-marcos")

    expect(metadata.title).toBe("Boda real")
    expect(metadata.openGraph?.title).toBe("Boda real")
    // El título real de esa ficha es "Laura & Marcos"; no debe aparecer.
    expect(metadata.title).not.toMatch(/Laura/i)
    expect(metadata.description).not.toMatch(/Laura/i)
  })

  it("la imagen de Open Graph es un asset público, no una URL firmada del bucket", () => {
    const images = vipStoryMetadata("CATERING_EVENT", "gala").openGraph?.images
    const serialized = JSON.stringify(images)

    expect(serialized).toContain("/images/")
    // Una URL firmada de Supabase llevaría "/storage/v1/object/sign" y un token.
    expect(serialized).not.toMatch(/storage\/v1\/object\/sign|token=/)
  })
})

describe("sitemap", () => {
  const urls = sitemap().map((entry) => entry.url)

  it("no incluye las bibliotecas VIP", () => {
    expect(urls.some((url) => url.includes("/bodas-reales"))).toBe(false)
    expect(urls.some((url) => url.includes("/catering"))).toBe(false)
  })

  it("no incluye ningún slug de ficha VIP", () => {
    expect(urls.some((url) => url.includes("laura-y-marcos"))).toBe(false)
    expect(urls.some((url) => url.includes("gala-empresa"))).toBe(false)
  })

  it("sí incluye la home y las páginas legales", () => {
    expect(urls.some((url) => url.endsWith("/"))).toBe(true)
    expect(urls.some((url) => url.endsWith("/politica-privacidad"))).toBe(true)
    expect(urls.some((url) => url.endsWith("/aviso-legal"))).toBe(true)
  })
})
