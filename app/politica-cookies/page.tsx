import type { Metadata } from "next"
import { brand } from "@/data/site-content"

export const metadata: Metadata = {
  title: "Política de cookies",
  alternates: { canonical: "/politica-cookies" },
  robots: { index: false, follow: true },
}

export default function PoliticaCookiesPage() {
  return (
    <main className="min-h-screen bg-background pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <h1 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-12">Política de cookies</h1>

        <div className="space-y-10 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">¿Qué son las cookies?</h2>
            <p>
              Las cookies son pequeños archivos que se almacenan en tu navegador al visitar un sitio web. Este sitio
              también utiliza el almacenamiento local del navegador (localStorage) con una función equivalente.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">Qué usamos actualmente</h2>
            <p>A día de hoy, este sitio utiliza únicamente almacenamiento técnico/necesario:</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-3"><span className="w-1 h-1 mt-2 bg-accent shrink-0" /><span><strong>Preferencia de cookies</strong> — recuerda si has aceptado o rechazado este aviso.</span></li>
              <li className="flex items-start gap-3"><span className="w-1 h-1 mt-2 bg-accent shrink-0" /><span><strong>Acceso a la biblioteca VIP</strong> — recuerda que ya has dejado tu email para ver los casos de bodas reales o catering, y evita pedírtelo de nuevo.</span></li>
            </ul>
            <p className="mt-3">
              Ninguna de estas dos funciones envía datos a terceros con fines publicitarios: solo se guardan en tu
              propio navegador.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">Cookies de análisis y publicidad</h2>
            <p>
              Actualmente no tenemos instaladas cookies de análisis (como Google Analytics) ni de publicidad. Si en el
              futuro se incorporan, actualizaremos esta política y solicitaremos tu consentimiento explícito antes de
              activarlas.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">Cómo gestionar las cookies</h2>
            <p>
              Puedes eliminar el almacenamiento local de este sitio en cualquier momento desde la configuración de tu
              navegador, o rechazando el aviso de cookies. Al hacerlo, es posible que tengas que volver a introducir tu
              email para acceder a la biblioteca VIP.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">Contacto</h2>
            <p>
              Si tienes dudas sobre esta política, escríbenos a {brand.email}.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
