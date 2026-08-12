import type { Metadata } from "next"
import type { ContentType } from "@prisma/client"

/**
 * Metadata de las rutas VIP.
 *
 * Deliberadamente **no consulta la base de datos**: construir el título a
 * partir de la ficha obligaría a leerla antes de validar el acceso, y el
 * `<title>` acabaría en el HTML de alguien que todavía no ha entrado. El slug
 * ya está en la URL, así que usarlo no revela nada nuevo.
 *
 * La imagen de Open Graph es un asset **público** del proyecto y nunca una URL
 * firmada del bucket privado: una tarjeta de red social tiene que poder
 * cargarla sin sesión, y una firma temporal caducaría.
 */

const OG_PLACEHOLDER = "/images/porton/04-exterior-finca.jpg"

const SECTION_META = {
  REAL_WEDDING: {
    basePath: "/bodas-reales",
    listTitle: "Bodas reales",
    listDescription:
      "Biblioteca privada de bodas celebradas en El Portón de la Condesa. Acceso con email.",
    itemTitle: "Boda real",
    itemDescription:
      "Caso completo de una boda celebrada en El Portón de la Condesa. Acceso con email.",
  },
  CATERING_EVENT: {
    basePath: "/catering",
    listTitle: "Catering",
    listDescription:
      "Biblioteca privada de eventos de catering de El Portón de la Condesa. Acceso con email.",
    itemTitle: "Evento de catering",
    itemDescription:
      "Caso completo de un evento de catering de El Portón de la Condesa. Acceso con email.",
  },
} as const satisfies Record<ContentType, unknown>

/**
 * `index: false` mientras **todo** el contenido de las bibliotecas esté detrás
 * del email: indexar una página que un buscador solo puede ver como
 * formulario no aporta nada y genera resultados engañosos. `follow: true` para
 * que el rastreo del resto del sitio no se corte aquí.
 */
const CLOSED_CONTENT_ROBOTS = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
} as const

export function vipLibraryMetadata(type: ContentType): Metadata {
  const meta = SECTION_META[type]
  return {
    title: meta.listTitle,
    description: meta.listDescription,
    alternates: { canonical: meta.basePath },
    robots: CLOSED_CONTENT_ROBOTS,
    openGraph: {
      title: meta.listTitle,
      description: meta.listDescription,
      url: meta.basePath,
      images: [{ url: OG_PLACEHOLDER }],
    },
  }
}

export function vipStoryMetadata(type: ContentType, slug: string): Metadata {
  const meta = SECTION_META[type]
  return {
    title: meta.itemTitle,
    description: meta.itemDescription,
    alternates: { canonical: `${meta.basePath}/${slug}` },
    robots: CLOSED_CONTENT_ROBOTS,
    openGraph: {
      title: meta.itemTitle,
      description: meta.itemDescription,
      url: `${meta.basePath}/${slug}`,
      images: [{ url: OG_PLACEHOLDER }],
    },
  }
}
