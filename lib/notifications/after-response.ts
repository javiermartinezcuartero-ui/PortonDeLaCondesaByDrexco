import "server-only"

import { after } from "next/server"

/**
 * Ejecuta un trabajo **después** de haber respondido al visitante.
 *
 * `after()` de Next.js es el mecanismo correcto en Vercel: mantiene viva la
 * invocación serverless hasta que el trabajo termina, pero sin retrasar la
 * respuesta. La alternativa habitual —lanzar la promesa con `void` y no esperarla—
 * parece equivalente y no lo es: en cuanto la función devuelve la respuesta, la
 * plataforma puede congelarla, y el envío queda a medias sin dejar rastro. Ese es
 * justo el fallo silencioso que este proyecto no quiere.
 *
 * El `catch` de reserva existe porque `after()` solo funciona dentro del ámbito de
 * una petición de Next. Fuera de él —un script de consola, un test que invoca el
 * Route Handler directamente— lanza, y entonces se ejecuta el trabajo sin más: en
 * esos contextos no hay respuesta que no bloquear ni función que se congele.
 *
 * En ninguno de los dos caminos se propaga un error del trabajo: quien llama a esto
 * ya ha confirmado su transacción y no debe enterarse de que un correo falló.
 */
export function runAfterResponse(task: () => Promise<unknown>): void {
  const guarded = async () => {
    try {
      await task()
    } catch (error) {
      console.error("[email] el trabajo posterior a la respuesta falló", {
        error: error instanceof Error ? error.message : "desconocido",
      })
    }
  }

  try {
    after(guarded)
  } catch {
    void guarded()
  }
}
