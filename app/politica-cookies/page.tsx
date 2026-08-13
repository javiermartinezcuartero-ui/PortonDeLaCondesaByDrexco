import type { Metadata } from "next"
import { brand } from "@/data/site-content"

export const metadata: Metadata = {
  title: "Política de cookies",
  alternates: { canonical: "/politica-cookies" },
  robots: { index: false, follow: true },
}

export default function PoliticaCookiesPage() {
  return (
    <main id="contenido" className="min-h-screen bg-background pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <h1 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-12">Política de cookies</h1>

        <div className="space-y-10 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">¿Qué son las cookies?</h2>
            <p>
              Las cookies son pequeños archivos que se almacenan en tu navegador al visitar un sitio web. Este sitio
              también utiliza el almacenamiento local del navegador (localStorage) para una función concreta, que se
              detalla más abajo.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">Qué usamos actualmente</h2>
            <p>
              A día de hoy este sitio utiliza únicamente almacenamiento{" "}
              <strong>técnico y funcional</strong>, necesario para que las funciones que pides funcionen. No hay cookies
              de análisis ni de publicidad, y por tanto no se instala ninguna que requiera tu consentimiento previo.
            </p>
            <ul className="mt-3 space-y-3">
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                <span>
                  <strong>Preferencia de este aviso</strong> — almacenamiento local (localStorage), sin caducidad
                  automática. Recuerda si ya has respondido a este aviso para no volver a mostrarlo.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                <span>
                  <strong>Acceso a la biblioteca VIP</strong> — cookie <code className="font-mono text-sm">porton_vip_access</code>,
                  30 días, <code className="font-mono text-sm">HttpOnly</code> (no accesible desde JavaScript) y{" "}
                  <code className="font-mono text-sm">SameSite=Lax</code>. Es una cookie{" "}
                  <strong>estrictamente necesaria y funcional</strong>: es lo que recuerda que ya dejaste tu email para
                  ver los casos de bodas reales o catering, de modo que no haya que pedírtelo en cada página. Sin ella
                  esa sección simplemente no puede funcionar, así que no requiere consentimiento previo de cookies —
                  aparte del consentimiento de privacidad que ya das al enviar el formulario.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                <span>
                  <strong>Sesión del panel privado</strong> — cookie de sesión para el equipo de la finca en la zona de
                  administración. No se instala a los visitantes.
                </span>
              </li>
            </ul>
            <p className="mt-3">
              La cookie de acceso VIP contiene únicamente un identificador aleatorio, no tu email ni ningún dato
              personal, y no se comparte con terceros con fines publicitarios.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">Cookies de análisis y publicidad</h2>
            <p>
              No tenemos instaladas cookies de análisis (como Google Analytics) ni de publicidad, ni ahora ni de forma
              latente: no hay ningún script de terceros esperando tu aceptación. Si en el futuro se incorporan,
              actualizaremos esta política y pediremos tu consentimiento explícito <strong>antes</strong> de activarlas.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">Cómo gestionar las cookies</h2>
            <p>
              Puedes eliminar las cookies y el almacenamiento local de este sitio en cualquier momento desde la
              configuración de tu navegador. Al hacerlo, es posible que tengas que volver a introducir tu email para
              acceder a la biblioteca VIP. También puedes pedirnos que revoquemos tu acceso escribiéndonos a{" "}
              {brand.email}.
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
