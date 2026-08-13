import type { Metadata } from "next"
import { brand } from "@/data/site-content"

export const metadata: Metadata = {
  title: "Aviso legal",
  alternates: { canonical: "/aviso-legal" },
  robots: { index: false, follow: true },
}

export default function AvisoLegalPage() {
  return (
    <main id="contenido" className="min-h-screen bg-background pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <h1 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-12">Aviso legal</h1>

        <div className="space-y-10 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">1. Datos del titular</h2>
            <p>
              El presente sitio web es titularidad de <strong>{brand.name}</strong>.
            </p>
            <p className="mt-2">
              Domicilio: {brand.address.line}, {brand.address.postalCode} {brand.address.city}, {brand.address.province}.
              <br />
              Email: {brand.email} · Teléfono: {brand.phone}
              <br />
              <span className="text-sm text-muted-foreground italic">
                [PENDIENTE: completar con CIF/NIF y datos de inscripción registral antes de publicar en producción]
              </span>
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">2. Objeto</h2>
            <p>
              A través de este sitio web, {brand.name} informa sobre sus espacios, servicios de bodas, celebraciones,
              gastronomía y catering, y permite a los usuarios solicitar información mediante formularios de contacto.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">3. Condiciones de uso</h2>
            <p>
              El acceso y uso de este sitio web implica la aceptación de las condiciones aquí expuestas. El usuario se
              compromete a hacer un uso adecuado de los contenidos y a no emplearlos para actividades ilícitas o
              contrarias a la buena fe y al orden público.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">4. Propiedad intelectual</h2>
            <p>
              Los contenidos, textos, imágenes, marcas y logotipos de este sitio web son propiedad de {brand.name} o de
              terceros que han autorizado su uso, y están protegidos por la normativa de propiedad intelectual e
              industrial. Queda prohibida su reproducción total o parcial sin autorización expresa.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">5. Enlaces a terceros</h2>
            <p>
              Este sitio incluye enlaces a redes sociales y plataformas de terceros (como Instagram, Bodas.net o
              WhatsApp). {brand.name} no se hace responsable del contenido de dichos sitios externos.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">6. Legislación aplicable</h2>
            <p>
              Las presentes condiciones se rigen por la legislación española. Para cualquier controversia, las partes
              se someterán a los juzgados y tribunales que correspondan conforme a derecho.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
