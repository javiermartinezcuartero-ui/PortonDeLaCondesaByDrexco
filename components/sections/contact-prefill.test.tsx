import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Precarga del formulario desde el CTA de una ficha VIP.
 *
 * Archivo aparte de `contact.test.tsx` porque aquí **no** se vuelve a elegir el
 * tipo de evento a mano: eso es justo lo que ocultaba el fallo. La prueba
 * existente rellenaba todos los campos obligatorios, incluido el desplegable, así
 * que pasaba aunque la precarga no funcionase.
 */

const submitLeadRequest = vi.fn()
vi.mock("@/lib/leads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/leads")>()
  return { ...actual, submitLeadRequest: (...args: unknown[]) => submitLeadRequest(...args) }
})

import { ContactSection } from "./contact"

beforeEach(() => {
  submitLeadRequest.mockReset()
  submitLeadRequest.mockResolvedValue({ ok: true, duplicate: false })

  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, "", "/")
})

/**
 * El desplegable, localizado por su nombre accesible.
 *
 * Antes se buscaba por texto visible y se subía al padre. Dejó de funcionar al ocultar
 * las etiquetas del formulario con `sr-only`: el mismo texto aparece en la etiqueta y
 * como marcador de posición dentro del control, así que la búsqueda encuentra dos
 * elementos. La asociación etiqueta→control devuelve uno solo, y es el correcto.
 */
function trigger(label: string) {
  return screen.getByLabelText(label)
}

describe("ContactSection — precarga desde el CTA de una ficha", () => {
  it("deja el tipo de evento ya elegido, visible en el desplegable", async () => {
    window.history.replaceState({}, "", "/?tipo=WEDDING&ficha=ckz0000000000000000000000")

    render(<ContactSection />)

    // Lo que ve la persona: el desplegable muestra "Boda", no el marcador de
    // posición. Si mostrara el marcador, creería que no ha elegido nada.
    await waitFor(() => expect(trigger("Tipo de evento")).toHaveTextContent("Boda"))
    expect(trigger("Tipo de evento")).not.toHaveAttribute("data-placeholder")
  })

  it("se puede enviar sin volver a tocar el tipo de evento", async () => {
    window.history.replaceState({}, "", "/?tipo=EXTERNAL_CATERING&ficha=ckz0000000000000000000001")

    const user = userEvent.setup()
    render(<ContactSection />)

    await user.type(screen.getByLabelText("Nombre y apellidos"), "Ana García")
    await user.type(screen.getByLabelText("Email"), "ana@ejemplo.test")
    await user.type(screen.getByLabelText("Mensaje"), "Queremos un catering así.")

    // Ya no hay que tocar ningún desplegable: el tipo de evento viene del enlace y el
    // espacio preferido se retiró del formulario. Es exactamente lo que esta prueba
    // vigila —que se pueda enviar sin repetir lo que ya venía puesto—, y ahora se
    // cumple con más motivo.
    await user.click(screen.getByRole("checkbox", { name: /acepto la política de privacidad/i }))
    await user.click(screen.getByRole("button", { name: /Enviar mensaje/ }))

    await waitFor(() => expect(submitLeadRequest).toHaveBeenCalled())
    // El tipo que viaja es el que traía el enlace, sin que nadie lo repita.
    expect(submitLeadRequest.mock.calls[0][0].eventType).toBe("EXTERNAL_CATERING")
  })

  it("un tipo inventado en la URL no se acepta: el campo queda sin elegir", async () => {
    window.history.replaceState({}, "", "/?tipo=NO_EXISTE&ficha=ckz0000000000000000000002")

    render(<ContactSection />)

    expect(trigger("Tipo de evento")).toHaveTextContent("Tipo de evento")
    expect(trigger("Tipo de evento")).toHaveAttribute("data-placeholder")
  })
})
