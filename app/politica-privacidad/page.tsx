import type { Metadata } from "next"
import { brand } from "@/data/site-content"

export const metadata: Metadata = {
  title: "Política de privacidad",
  alternates: { canonical: "/politica-privacidad" },
  robots: { index: false, follow: true },
}

export default function PoliticaPrivacidadPage() {
  return (
    <main id="contenido" className="min-h-screen bg-background pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <h1 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-12">Política de privacidad</h1>

        <div className="space-y-10 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">1. Responsable del tratamiento</h2>
            <p>
              {brand.name}, con domicilio en {brand.address.line}, {brand.address.postalCode} {brand.address.city},{" "}
              {brand.address.province}, es responsable del tratamiento de los datos personales que nos facilites a
              través de este sitio web. Puedes contactarnos en {brand.email} o en el teléfono {brand.phone}.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">2. Qué datos tratamos</h2>
            <p>Tratamos los datos que nos facilitas voluntariamente a través de:</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-3"><span className="w-1 h-1 mt-2 bg-accent shrink-0" />El formulario de solicitud de información: nombre, apellidos, email, teléfono, tipo de evento, fecha prevista, número de invitados, espacio de interés, presupuesto orientativo, asunto y mensaje. En eventos de empresa, también la empresa u organización, el cargo y las necesidades audiovisuales que nos indiques.</li>
              <li className="flex items-start gap-3"><span className="w-1 h-1 mt-2 bg-accent shrink-0" />El acceso a la biblioteca VIP de bodas reales y catering: email.</li>
              <li className="flex items-start gap-3"><span className="w-1 h-1 mt-2 bg-accent shrink-0" />Datos técnicos de navegación y de origen de la visita (página de entrada, referente y parámetros UTM), para saber qué canal generó tu consulta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">3. Con qué finalidad</h2>
            <p>Utilizamos tus datos para:</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-3"><span className="w-1 h-1 mt-2 bg-accent shrink-0" />Responder a tu solicitud de información sobre bodas, celebraciones, espacios, gastronomía o catering.</li>
              <li className="flex items-start gap-3"><span className="w-1 h-1 mt-2 bg-accent shrink-0" />Darte acceso a los contenidos de la biblioteca VIP.</li>
              <li className="flex items-start gap-3"><span className="w-1 h-1 mt-2 bg-accent shrink-0" />Enviarte comunicaciones comerciales, únicamente si has marcado la casilla de consentimiento correspondiente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">4. Base legal</h2>
            <p>
              El tratamiento se basa en tu consentimiento expreso, otorgado al enviar el formulario de contacto o el
              formulario de acceso VIP, y aceptar esta política de privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">5. Quién trata tus datos por nuestra cuenta</h2>
            <p>
              Los formularios de esta web se procesan en nuestros propios servidores y los datos se guardan en la base
              de datos de gestión de clientes de {brand.name}. Intervienen estos proveedores como encargados del
              tratamiento:
            </p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                <span>
                  <strong>Supabase</strong> — base de datos PostgreSQL donde se guardan tus datos de contacto y tu
                  solicitud, y almacenamiento privado de los archivos de las fichas.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                <span>
                  <strong>Vercel</strong> — alojamiento y ejecución de la web.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                <span>
                  <strong>Resend</strong> — envío de los correos de aviso interno y, si procede, del acuse de
                  recibo. Recibe tu dirección de correo y el contenido del mensaje que nos escribes, que es lo
                  que hace falta para entregarlo.
                </span>
              </li>
            </ul>
            <p className="mt-3">
              No cedemos tus datos a terceros para fines distintos de los descritos, salvo obligación legal. No
              utilizamos ningún servicio externo de reenvío de formularios por email.
            </p>
            <p className="mt-3 text-sm text-muted-foreground italic">
              [PENDIENTE DE REVISIÓN JURÍDICA: este apartado describe el tratamiento técnico real y verificado en el
              código, pero el texto legal definitivo —la identificación registral de cada encargado, los contratos de
              encargo del artículo 28 del RGPD y la ubicación de los servidores y sus posibles transferencias
              internacionales— debe redactarlo o validarlo un profesional antes de publicar en producción.]
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">6. Cuánto tiempo conservamos tus datos</h2>
            <p>
              Conservamos tus datos mientras sean necesarios para gestionar tu solicitud y, si has dado tu
              consentimiento comercial, hasta que lo retires. Pasado ese periodo, los datos que te identifican se
              anonimizan de forma no reversible y solo se conservan cifras agregadas que no permiten volver a
              identificarte.
            </p>
            <p className="mt-3 text-sm text-muted-foreground italic">
              [PENDIENTE DE REVISIÓN JURÍDICA: el sistema tiene un plazo de retención configurable y un procedimiento de
              anonimización ya implementado y verificado, pero <strong>el plazo concreto que debe aplicarse no está
              fijado por un profesional</strong>. No se indica aquí una cifra para no dar por definitivo un plazo que
              nadie ha validado.]
            </p>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.15em] uppercase text-muted-foreground mb-3">7. Tus derechos</h2>
            <p>
              Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad
              escribiendo a {brand.email}. También puedes reclamar ante la Agencia Española de Protección de Datos
              (www.aepd.es) si consideras que no hemos tratado tus datos correctamente.
            </p>
            <p className="mt-3">
              En particular: podemos entregarte una copia completa de todo lo que consta sobre ti en nuestro sistema,
              retirar tu consentimiento de comunicaciones comerciales sin que eso afecte a la gestión de tu solicitud, y
              revocar el acceso a la biblioteca VIP asociado a tu email.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
