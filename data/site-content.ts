/**
 * Capa de contenido centralizada de El Portón de la Condesa.
 *
 * Fuente de verdad: `project-reference/` (extracción web + investigación de Instagram).
 * Todo dato aquí presente está verificado en esa carpeta. Los campos marcados con
 * TODO señalan contenido pendiente de confirmación o de desarrollo posterior
 * (páginas secundarias, API de leads, CRM).
 *
 * TODO(derechos-imagen): `02-salon-celebraciones.jpg` lleva marca de agua de
 * fotógrafo externo (Silvia Ferrer). Antes de publicar en producción, confirmar
 * con el cliente que existen derechos de uso para la web, o sustituirla por
 * fotografía propia. `01`, `03` y `04` llevan la marca de agua propia de la
 * finca. `05` se recortó para eliminar la marca de agua de Fredy Mazza.
 */

export const brand = {
  name: "El Portón de la Condesa",
  website: "https://elportondelacondesa.com/",
  email: "info@elportondelacondesa.com",
  phone: "968 13 98 00",
  // NOTA: el aviso legal del sitio original muestra un teléfono/código postal
  // distinto en algunos puntos. TODO: verificar con el cliente antes de publicar.
  address: {
    line: "Avda. Principal la Alcayna, s/n",
    postalCode: "30500",
    city: "Molina de Segura",
    province: "Murcia",
  },
  locationLabel: "Molina de Segura · Murcia",
  // Coordenadas mostradas en la web original (docs/01-extraccion-web.md).
  coordinates: {
    label: "38°04’37.8″ N · 1°09’01.5″ W",
    lat: 38.077167,
    lng: -1.150417,
    // Embed sin API key (funciona sin clave de Google Maps Platform). El
    // color de marca se aplica con un filtro CSS sobre el iframe: una
    // recoloración real del mapa requeriría el Maps JavaScript API (de pago).
    embedUrl: "https://www.google.com/maps?q=38.077167,-1.150417&z=15&output=embed",
    // Enlace con ruta precargada: abre la app de Google Maps en móvil (o la
    // web en escritorio) con la ruta desde la ubicación del usuario ya lista.
    externalUrl: "https://www.google.com/maps/dir/?api=1&destination=38.077167,-1.150417",
  },
  logo: {
    transparent: "/brand/logo-porton-transparent-hq.png",
    solid: "/brand/logo-porton-hq.png",
    icon: "/brand/icon-porton-hq.png",
    iconOnGreen: "/brand/icon-porton-on-green.png",
  },
  palette: {
    primaryDarkGreen: "#182605",
    accentCoralRed: "#FF422C",
  },
  social: {
    instagram: {
      handle: "@elportondelacondesa",
      url: "https://www.instagram.com/elportondelacondesa/",
    },
    facebook: {
      label: "Facebook",
      url: "https://www.facebook.com/ElPortonDeLaCondesa/?locale=es_ES",
    },
    // TODO: confirmar con el cliente que esta es la ficha real antes de publicar en producción.
    bodasNet: {
      label: "Bodas.net",
      url: "https://www.bodas.net/fincas/el-porton-de-la-condesa--e39525",
    },
  },
  whatsapp: {
    number: "34619865403",
    displayNumber: "+34 619 86 54 03",
    message: "Hola, me gustaría más información sobre El Portón de la Condesa.",
  },
  // Crédito discreto de la agencia/desarrollador en el footer.
  credits: {
    name: "Solucionesbonicas.com",
    url: "https://www.solucionesbonicas.com",
  },
  positioningPhrase: "El escenario perfecto para días únicos e irrepetibles",
} as const

export type NavItem = {
  label: string
  href: string
  /** false cuando el destino es un ancla temporal a la espera de una ruta propia */
  isRoute: boolean
}

// Los anclas (`/#vision`, ...) apuntan a secciones de la home. Se resuelven
// bien desde cualquier página porque el Header/Footer son globales.
// TODO: migrar `Bodas`, `Gastronomía` y `Celebraciones` a rutas propias
// cuando existan esas páginas secundarias.
export const navigation: NavItem[] = [
  { label: "Bodas", href: "/#vision", isRoute: false },
  { label: "Espacios", href: "/#espacios", isRoute: false },
  { label: "Gastronomía", href: "/#gastronomia", isRoute: false },
  { label: "Celebraciones", href: "/#filosofia", isRoute: false },
  { label: "Catering", href: "/catering", isRoute: true },
  { label: "Bodas reales", href: "/bodas-reales", isRoute: true },
  { label: "Contacto", href: "/#contacto", isRoute: false },
]

export const headerCta = {
  label: "Solicita información",
  href: "/#contacto",
}

export const heroContent = {
  headlineLines: [
    { text: "El escenario", accent: false },
    { text: "perfecto para tu", accent: false },
    { text: "gran día", accent: true },
  ],
  supportingText:
    "Finca para bodas y celebraciones en Molina de Segura (Murcia), con salones, jardines y gastronomía pensados para acompañarte en cada momento de tu evento.",
  image: {
    src: "/images/porton/01-boda-civil-jardin.jpg",
    alt: "Ceremonia civil en el jardín de El Portón de la Condesa",
  },
  ctaPrimary: { label: "Solicita información", href: "#contacto" },
  ctaSecondary: { label: "Descubre nuestros espacios", href: "#espacios" },
}

export const visionContent = {
  label: "Presentación",
  statement:
    "Creemos que cada celebración merece un espacio a su altura: salones, jardines y terrazas donde solo queden los recuerdos.",
  paragraphs: [
    "El Portón de la Condesa es una finca para bodas y celebraciones en Molina de Segura, Murcia, pensada para acompañar a cada pareja o familia desde la primera visita hasta el último baile.",
    "Combinamos espacios interiores y exteriores, jardines y terrazas, con una gastronomía cuidada y un equipo que personaliza decoración, montaje e iluminación para cada evento.",
  ],
  // Únicamente datos verificados: el número de espacios es un hecho (4 salones);
  // el resto son categorías de servicio confirmadas, no cifras inventadas.
  highlights: [
    { value: "4", label: "Salones y espacios" },
    { value: "Bodas", label: "Civiles y celebraciones" },
    { value: "Empresas", label: "Eventos corporativos" },
    { value: "Catering", label: "Dentro y fuera de la finca" },
  ],
}

export const philosophyContent = {
  label: "Filosofía",
  title: "Cuatro principios que guían cada celebración",
  principles: [
    {
      number: "01",
      title: "Gastronomía como protagonista",
      description:
        "Cóctel, banquete y servicio se plantean como parte central de la experiencia, con producto de calidad y menús adaptables a cada evento.",
    },
    {
      number: "02",
      title: "Personalización de cada detalle",
      description:
        "Decoración, iluminación y montaje se adaptan a cada pareja o familia, en colaboración con proveedores externos de floristería, fotografía, música y animación.",
    },
    {
      number: "03",
      title: "Espacios que se combinan",
      description:
        "Salones interiores y zonas exteriores —jardines y terrazas— se combinan según el tipo de celebración y el momento del evento.",
    },
    {
      number: "04",
      title: "Acompañamiento constante",
      description:
        "Desde la primera visita hasta la celebración, un equipo acompaña la preparación del evento y resuelve dudas en cada fase.",
    },
  ],
  image: {
    src: "/images/porton/05-salon-porton-decoracion.jpg",
    alt: "Detalle de decoración en un salón de El Portón de la Condesa",
  },
  imageCaption: "Detalle y personalización en cada montaje",
}

export const experienceContent = {
  label: "Tu celebración, paso a paso",
  title: "Tu celebración, orquestada en cuatro movimientos",
  description:
    "Acompañamos cada evento desde la primera visita hasta el día de la celebración, con una propuesta que se ajusta a tus necesidades en cada fase.",
  image: {
    src: "/images/porton/03-boda-civil-invitados.jpg",
    alt: "Invitados durante una ceremonia civil en El Portón de la Condesa",
  },
  steps: [
    {
      course: "Descubrimiento",
      timing: "Primer contacto",
      title: "Visita a la finca",
      description:
        "Conoces los espacios disponibles, visitas salones, jardines y terrazas, y resuelves tus primeras dudas con el equipo.",
      details: ["Visita guiada", "Espacios interiores y exteriores", "Primer contacto con el equipo", "Resolución de dudas iniciales"],
    },
    {
      course: "Propuesta",
      timing: "Segunda fase",
      title: "Tu propuesta a medida",
      description:
        "A partir de lo que buscas, preparamos una propuesta orientada al tipo de celebración, número de invitados y espacios elegidos.",
      details: ["Tipo de evento", "Espacios seleccionados", "Primera aproximación gastronómica", "Fecha prevista"],
    },
    {
      course: "Personalización",
      timing: "Tercera fase",
      title: "Cada detalle a tu manera",
      description:
        "Decoración, montaje, iluminación y proveedores externos se coordinan para que la celebración refleje lo que quieres transmitir.",
      details: ["Decoración y montaje", "Iluminación", "Proveedores externos", "Menú y servicio"],
    },
    {
      course: "Celebración",
      timing: "El gran día",
      title: "Tu gran día",
      description:
        "El equipo acompaña la celebración de principio a fin, para que solo tengas que disfrutarla junto a los tuyos.",
      details: ["Ceremonia", "Cóctel", "Banquete", "Fiesta"],
    },
  ],
}

// Fotografía de apoyo bajo licencia Unsplash (uso comercial libre, sin atribución
// obligatoria — https://unsplash.com/license): no son fotografías reales de El
// Portón de la Condesa, sino imágenes editoriales coherentes con cada pilar
// gastronómico, a la espera de fotografía propia del restaurante.
// - producto-temporada.jpg: photo-1750943082640-66f9fd0a4608
// - coctel-banquete.jpg: photo-1473366514866-3649b6c30284
// - salon-celebracion-2.jpg: photo-1763429338698-439aa108e7fb
export const gastronomyContent = {
  label: "Gastronomía",
  title: "Una gastronomía pensada para cada celebración",
  pillars: [
    {
      id: "producto-temporada",
      name: "Producto y temporada",
      subtitle: "Tradición e innovación",
      description:
        "Cocina orientada a celebraciones y eventos, con producto y materias primas de calidad que combinan tradición, innovación y presentación.",
      image: { src: "/images/gastronomia/producto-temporada.jpg", alt: "Emplatado de alta cocina con producto de temporada" },
    },
    {
      id: "coctel-banquete",
      name: "Cóctel y banquete",
      subtitle: "El servicio como experiencia",
      description:
        "El cóctel, el banquete y el servicio son parte central de la propuesta, pensados para acompañar cada momento del evento.",
      image: { src: "/images/gastronomia/coctel-banquete.jpg", alt: "Servicio de cóctel con bandeja de aperitivos" },
    },
    {
      id: "adaptado-evento",
      name: "Adaptado a cada celebración",
      subtitle: "Menús a medida",
      description:
        "Los menús se adaptan a cada evento. La capacidad de ajustar propuestas a restricciones o necesidades alimentarias debe consultarse con el equipo antes de confirmar el menú.",
      image: { src: "/images/gastronomia/salon-celebracion-2.jpg", alt: "Salón con grandes ventanales dispuesto para un banquete" },
    },
  ],
  note:
    "La propuesta gastronómica se adapta a cada celebración; consulta menús y opciones para necesidades alimentarias con nuestro equipo.",
}

export type SpaceContent = {
  slug: string
  name: string
  type: string
  description: string
  features: string[]
  recommendedFor: string[]
  image: { src: string; alt: string }
}

// Características y usos recomendados extraídos de project-reference/docs/01-extraccion-web.md.
// No se publican aforos ni cifras de capacidad: no están confirmados.
export const spacesContent: SpaceContent[] = [
  {
    slug: "salon-porton",
    name: "Salón Portón",
    type: "Salón interior combinable con exteriores",
    description:
      "Uno de los espacios de mayor capacidad de la finca. Un salón versátil, combinado con jardines y terrazas exteriores.",
    features: ["Amplitud y versatilidad", "Combinable con jardines y terrazas", "Renovación decorativa reciente"],
    recommendedFor: ["Bodas", "Comuniones", "Aniversarios", "Bautizos", "Eventos corporativos", "Cenas de empresa", "Congresos"],
    image: { src: "/images/porton/05-salon-porton-decoracion.jpg", alt: "Salón Portón decorado para una celebración" },
  },
  {
    slug: "salon-zafiro",
    name: "Salón Zafiro",
    type: "Salón interior de gran formato",
    description: "Uno de los salones más amplios de la finca, pensado para eventos de gran formato.",
    features: ["Elegancia y confort", "Flexibilidad de montaje", "Preparado para eventos de gran formato"],
    recommendedFor: ["Bodas", "Celebraciones familiares", "Eventos de gran formato"],
    image: { src: "/images/porton/02-salon-celebraciones.jpg", alt: "Salón Zafiro preparado para un banquete" },
  },
  {
    slug: "salon-cristal",
    name: "Salón Cristal",
    type: "Salón luminoso con vistas a jardines",
    description:
      "Un espacio luminoso y moderno, con grandes ventanales, luz natural y vistas a zonas ajardinadas.",
    features: ["Grandes ventanales", "Luz natural", "Vistas a zonas ajardinadas"],
    recommendedFor: ["Bodas", "Comuniones", "Aniversarios", "Bautizos", "Reuniones de empresa", "Conferencias"],
    image: { src: "/images/porton/01-boda-civil-jardin.jpg", alt: "Luz natural y jardines junto al Salón Cristal" },
  },
  {
    slug: "salon-conde",
    name: "Salón Conde",
    type: "Salón combinable con zonas exteriores",
    description: "Parte del conjunto de cuatro salones de la finca, asociado a zonas exteriores y formatos de evento adaptables.",
    features: ["Zonas exteriores asociadas", "Formatos de evento adaptables"],
    recommendedFor: ["Celebraciones familiares", "Eventos adaptables"],
    image: { src: "/images/porton/04-exterior-finca.jpg", alt: "Zona exterior de la finca junto al Salón Conde" },
  },
]

export const spacesSectionContent = {
  label: "Espacios",
  title: "Nuestros espacios",
  cta: { label: "Consultar disponibilidad", href: "#contacto" },
}

export const eventTypes = [
  "Boda",
  "Ceremonia civil",
  "Comunión",
  "Bautizo",
  "Aniversario",
  "Evento corporativo",
  "Congreso o convención",
  "Catering externo",
  "Otro",
] as const

export const contactContent = {
  label: "Contacto",
  title: "Cuéntanos sobre tu celebración",
  description:
    "Cuéntanos qué estás celebrando y te ayudaremos a dar forma a tu evento en El Portón de la Condesa.",
}

export const mapContent = {
  title: "Cómo llegar",
  description: `${brand.address.line}, ${brand.address.postalCode} ${brand.address.city}, ${brand.address.province}`,
  ctaLabel: "Abrir en Google Maps",
}

export const footerContent = {
  legalLinks: [
    { label: "Aviso legal", href: "/aviso-legal" },
    { label: "Política de privacidad", href: "/politica-privacidad" },
    { label: "Política de cookies", href: "/politica-cookies" },
  ],
  decorativePhrase: brand.positioningPhrase,
}

export const cookieConsentContent = {
  message:
    "Usamos cookies propias y de análisis para mejorar tu experiencia. Puedes aceptarlas o rechazar las que no sean estrictamente necesarias.",
  acceptLabel: "Aceptar",
  rejectLabel: "Rechazar no esenciales",
  policyLink: { label: "Política de cookies", href: "/politica-cookies" },
  storageKey: "porton-cookie-consent",
}

export const adminAccessContent = {
  tooltip: "Zona Admin",
  dialogTitle: "Acceso restringido",
  dialogDescription:
    "Esta zona está reservada al equipo de El Portón de la Condesa.",
  placeholder: "Contraseña",
  submitLabel: "Entrar",
  pendingMessage:
    "El backend de administración todavía no está conectado. Cuando me pases el prompt para /admin, este acceso quedará operativo.",
}
