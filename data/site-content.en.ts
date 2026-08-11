/**
 * English copy for the main homepage sections and shared UI chrome.
 *
 * Scope note: the VIP example stories (bodas-reales / catering) and the
 * legal pages remain Spanish-only for now — translating that volume of
 * illustrative content was out of scope for this pass. TODO(i18n): translate
 * data/vip-stories.ts and the /aviso-legal, /politica-privacidad,
 * /politica-cookies pages when full bilingual coverage is needed.
 */
import type { NavItem } from "@/data/site-content"
import { brand } from "@/data/site-content"

export const navigation: NavItem[] = [
  { label: "Weddings", href: "/#vision", isRoute: false },
  { label: "Spaces", href: "/#espacios", isRoute: false },
  { label: "Gastronomy", href: "/#gastronomia", isRoute: false },
  { label: "Celebrations", href: "/#filosofia", isRoute: false },
  { label: "Catering", href: "/catering", isRoute: true },
  { label: "Real weddings", href: "/bodas-reales", isRoute: true },
  { label: "Contact", href: "/#contacto", isRoute: false },
]

export const headerCta = {
  label: "Request information",
  href: "/#contacto",
}

export const heroContent = {
  headlineLines: [
    { text: "The perfect", accent: false },
    { text: "setting for your", accent: false },
    { text: "big day", accent: true },
  ],
  supportingText:
    "A wedding and celebration venue in Molina de Segura (Murcia), with halls, gardens and cuisine designed to be with you at every moment of your event.",
  image: {
    src: "/images/porton/01-boda-civil-jardin.jpg",
    alt: "Civil ceremony in the garden of El Portón de la Condesa",
  },
  ctaPrimary: { label: "Request information", href: "/#contacto" },
  ctaSecondary: { label: "Discover our spaces", href: "/#espacios" },
}

export const visionContent = {
  label: "Overview",
  statement:
    "We believe every celebration deserves a space of its own: halls, gardens and terraces where only the memories remain.",
  paragraphs: [
    "El Portón de la Condesa is a wedding and celebration venue in Molina de Segura, Murcia, designed to be with every couple or family from the first visit to the last dance.",
    "We combine indoor and outdoor spaces, gardens and terraces, with carefully prepared cuisine and a team that personalises decoration, set-up and lighting for every event.",
  ],
  highlights: [
    { value: "4", label: "Halls and spaces" },
    { value: "Weddings", label: "Civil & celebrations" },
    { value: "Business", label: "Corporate events" },
    { value: "Catering", label: "On and off site" },
  ],
}

export const philosophyContent = {
  label: "Philosophy",
  title: "Four principles behind every celebration",
  principles: [
    {
      number: "01",
      title: "Cuisine takes centre stage",
      description:
        "Cocktail hour, banquet and service are all central to the experience, with quality produce and menus tailored to each event.",
    },
    {
      number: "02",
      title: "Every detail, personalised",
      description:
        "Decoration, lighting and set-up are adapted to each couple or family, working with external florists, photographers, musicians and entertainers.",
    },
    {
      number: "03",
      title: "Spaces that combine",
      description:
        "Indoor halls and outdoor areas — gardens and terraces — are combined according to the type of celebration and the moment of the event.",
    },
    {
      number: "04",
      title: "Support all the way",
      description:
        "From the first visit to the celebration itself, our team supports you throughout the planning and answers questions at every stage.",
    },
  ],
  image: {
    src: "/images/porton/05-salon-porton-decoracion.jpg",
    alt: "Decoration detail in one of El Portón de la Condesa's halls",
  },
  imageCaption: "Detail and personalisation in every set-up",
}

export const experienceContent = {
  label: "Your celebration, step by step",
  title: "Your celebration, orchestrated in four movements",
  description:
    "We support every event from the first visit to the day of the celebration, with a proposal that adapts to your needs at every stage.",
  image: {
    src: "/images/porton/03-boda-civil-invitados.jpg",
    alt: "Guests during a civil ceremony at El Portón de la Condesa",
  },
  steps: [
    {
      course: "Discovery",
      timing: "First contact",
      title: "Visit to the venue",
      description:
        "You get to know the available spaces, tour halls, gardens and terraces, and settle your first questions with the team.",
      details: ["Guided visit", "Indoor & outdoor spaces", "First contact with the team", "Initial questions answered"],
    },
    {
      course: "Proposal",
      timing: "Second stage",
      title: "Your tailored proposal",
      description:
        "Based on what you're looking for, we prepare a proposal geared to your type of celebration, guest count and chosen spaces.",
      details: ["Type of event", "Selected spaces", "First culinary approach", "Planned date"],
    },
    {
      course: "Personalisation",
      timing: "Third stage",
      title: "Every detail, your way",
      description:
        "Decoration, set-up, lighting and external suppliers are coordinated so the celebration reflects exactly what you want to convey.",
      details: ["Decoration & set-up", "Lighting", "External suppliers", "Menu & service"],
    },
    {
      course: "Celebration",
      timing: "The big day",
      title: "Your big day",
      description:
        "Our team is with you from start to finish, so all you have to do is enjoy it alongside your loved ones.",
      details: ["Ceremony", "Cocktail hour", "Banquet", "Party"],
    },
  ],
}

export const gastronomyContent = {
  label: "Gastronomy",
  title: "Cuisine designed for every celebration",
  pillars: [
    {
      id: "producto-temporada",
      name: "Produce & season",
      subtitle: "Tradition and innovation",
      description:
        "Cuisine geared towards celebrations and events, with quality produce that blends tradition, innovation and presentation.",
      image: { src: "/images/gastronomia/producto-temporada.jpg", alt: "Fine-dining plating with seasonal produce" },
    },
    {
      id: "coctel-banquete",
      name: "Cocktail hour & banquet",
      subtitle: "Service as an experience",
      description:
        "Cocktail hour, banquet and service are all central to the proposal, designed to accompany every moment of the event.",
      image: { src: "/images/gastronomia/coctel-banquete.jpg", alt: "Cocktail service with a tray of canapés" },
    },
    {
      id: "adaptado-evento",
      name: "Tailored to each celebration",
      subtitle: "Menus made to measure",
      description:
        "Menus are adapted to each event. Any adjustment for dietary restrictions or needs should be confirmed with the team before finalising the menu.",
      image: { src: "/images/gastronomia/salon-celebracion-2.jpg", alt: "Hall with large windows set up for a banquet" },
    },
  ],
  note:
    "The culinary proposal adapts to each celebration; check menus and options for dietary needs with our team.",
}

export const spacesSectionContent = {
  label: "Spaces",
  title: "Our spaces",
  cta: { label: "Check availability", href: "/#contacto" },
}

export const eventTypes = [
  "Wedding",
  "Civil ceremony",
  "First communion",
  "Christening",
  "Anniversary",
  "Corporate event",
  "Congress or convention",
  "External catering",
  "Other",
] as const

export const contactContent = {
  label: "Contact",
  title: "Tell us about your celebration",
  description:
    "Tell us what you're celebrating and we'll help you shape your event at El Portón de la Condesa.",
}

export const mapContent = {
  title: "How to get here",
  description: `${brand.address.line}, ${brand.address.postalCode} ${brand.address.city}, ${brand.address.province}`,
  ctaLabel: "Open in Google Maps",
}

export const footerContent = {
  legalLinks: [
    { label: "Legal notice", href: "/aviso-legal" },
    { label: "Privacy policy", href: "/politica-privacidad" },
    { label: "Cookie policy", href: "/politica-cookies" },
  ],
  decorativePhrase: "The perfect setting for unique, unrepeatable days",
}

export const cookieConsentContent = {
  message:
    "We use our own and analytics cookies to improve your experience. You can accept them or reject the non-essential ones.",
  acceptLabel: "Accept",
  rejectLabel: "Reject non-essential",
  policyLink: { label: "Cookie policy", href: "/politica-cookies" },
}

export const adminAccessContent = {
  tooltip: "Admin area",
  dialogTitle: "Restricted access",
  dialogDescription: "This area is reserved for the El Portón de la Condesa team.",
  placeholder: "Password",
  submitLabel: "Enter",
  pendingMessage:
    "The admin backend isn't connected yet. Once you send me the prompt for /admin, this access will become operational.",
}
