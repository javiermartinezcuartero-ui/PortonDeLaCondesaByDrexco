import { brand } from "@/data/site-content"

export function LocalBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "EventVenue"],
    "@id": `${brand.website}#organization`,
    name: brand.name,
    url: brand.website,
    image: `${brand.website}images/porton/01-boda-civil-jardin.jpg`,
    telephone: brand.phone,
    email: brand.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: brand.address.line,
      postalCode: brand.address.postalCode,
      addressLocality: brand.address.city,
      addressRegion: brand.address.province,
      addressCountry: "ES",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: brand.coordinates.lat,
      longitude: brand.coordinates.lng,
    },
    sameAs: [
      brand.social.instagram.url,
      brand.social.facebook.url,
      brand.social.bodasNet.url,
    ],
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
