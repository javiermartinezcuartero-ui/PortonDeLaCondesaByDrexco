import { brand } from "@/data/site-content"
import { PreloaderDismiss } from "./site-preloader-dismiss"

/**
 * Cortina de carga del sitio público.
 *
 * Lo primero, porque conviene no venderla como lo que no es: **un preloader no hace que
 * la web cargue más rápido**. Lo que hace es tapar el momento en que la página se pinta a
 * medias —tipografía del sistema que salta a la definitiva, imágenes que entran de una en
 * una, el hero sin su fotografía— y sustituirlo por una pantalla de marca. En una conexión
 * lenta eso es una mejora real de percepción; en una rápida es un instante de más. Se pide
 * así y se hace así, pero el diseño está pensado para que ese "instante de más" sea corto
 * y para que **nunca pueda dejar el sitio inservible**, que es el riesgo de verdad de esta
 * pieza.
 *
 * Tres decisiones sostienen eso:
 *
 * 1. **La cortina se pinta desde el servidor**, en el HTML inicial. Es la única forma de
 *    que esté delante en el primer pintado: un componente de cliente aparecería después de
 *    descargar y ejecutar el bundle, es decir, justo cuando ya no hace falta.
 * 2. **Quien la retira es el CSS; el JavaScript solo lo adelanta.** La regla lleva una
 *    animación de rendición con retardo (ver `.site-preloader` en app/globals.css) que la
 *    desvanece sola. Si el JavaScript no llega —bloqueado, error de hidratación, un chunk
 *    que no baja— la web se ve igual. Al revés, con el JavaScript como único responsable,
 *    cualquiera de esos fallos deja una pantalla en blanco permanente.
 * 3. **Nunca captura el puntero** (`pointer-events: none`). Aunque algo fallara y se
 *    quedara visible, los enlaces de debajo siguen respondiendo.
 *
 * El logotipo se pinta con la misma técnica que en la cabecera —máscara sobre el verde de
 * marca— para que sea exactamente el mismo objeto y no un PNG de otro color, y va con
 * `aria-hidden`: la cortina no anuncia nada porque el contenido real ya está en el árbol
 * de accesibilidad, debajo. Un lector de pantalla no espera a que la fotografía cargue.
 */
export function SitePreloader() {
  return (
    <div id="site-preloader" className="site-preloader" aria-hidden="true">
      <div className="site-preloader__marca">
        <span
          className="site-preloader__logo"
          style={{
            aspectRatio: "3344 / 852",
            WebkitMaskImage: `url(${brand.logo.transparent})`,
            maskImage: `url(${brand.logo.transparent})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
        <span className="site-preloader__linea" />
      </div>
      <PreloaderDismiss />
    </div>
  )
}
