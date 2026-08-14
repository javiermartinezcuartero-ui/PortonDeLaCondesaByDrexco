"use client"

import { useEffect } from "react"

/** Clase que marca «el documento ya cargó». Vive en `<html>`, no en la cortina. */
const CARGADO = "cargado"

/**
 * Retira la cortina de carga en cuanto el documento termina de cargar.
 *
 * No pinta nada: es solo el efecto. Y no toca la cortina, **toca `<html>`**, que es la
 * parte no evidente de esto y la que resuelve un problema concreto.
 *
 * La cortina se monta dentro de `PublicChrome`, así que se desmonta al entrar en /admin y
 * se vuelve a montar al salir. Si la marca de «ya cargó» viviera en la propia cortina —un
 * `data-listo` en su elemento—, cada vuelta al sitio público la traería otra vez opaca y
 * habría un destello de cortina en una navegación que no carga nada. `<html>` no se
 * desmonta nunca, así que con la clase puesta la cortina nace ya invisible: su primer
 * pintado es con `opacity: 0`, sin transición que recorrer.
 *
 * `readyState` se comprueba antes de escuchar `load` porque en la mayoría de las cargas
 * este efecto corre **después** de que el evento haya pasado —React hidrata con los
 * scripts diferidos, que se ejecutan antes de `load` en la primera carga, pero en una
 * navegación posterior el documento ya está completo—, y un oyente de un evento que ya
 * ocurrió no se dispara nunca.
 */
export function PreloaderDismiss() {
  useEffect(() => {
    const raiz = document.documentElement
    if (raiz.classList.contains(CARGADO)) return

    const marcar = () => raiz.classList.add(CARGADO)

    if (document.readyState === "complete") {
      marcar()
      return
    }

    window.addEventListener("load", marcar, { once: true })
    return () => window.removeEventListener("load", marcar)
  }, [])

  return null
}
