import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * El formulario comercial se reescribió por completo en la Fase 6. Estas pruebas
 * cubren lo que solo se ve desde el navegador: que se pinta, que los mensajes de
 * validación salen traducidos, que los campos de empresa aparecen solo en un
 * evento corporativo, que el honeypot queda fuera del alcance de una persona y
 * que el resultado del servidor se anuncia en una región `aria-live` que además
 * recibe el foco.
 *
 * El envío se intercepta en `lib/leads`: aquí no se prueba el endpoint (eso está
 * en app/api/leads/requests/route.test.ts), sino la interfaz.
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

  // La sección usa IntersectionObserver para su animación de entrada; jsdom no
  // lo implementa.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )

  // Los desplegables de Radix dependen de ResizeObserver y de estas APIs de
  // puntero y de scroll, que jsdom tampoco tiene. Sin ellas no se pueden abrir.
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

describe("ContactSection — interfaz", () => {
  it("pinta los campos de la solicitud", () => {
    render(<ContactSection />)

    expect(screen.getByLabelText("Nombre")).toBeInTheDocument()
    expect(screen.getByLabelText("Apellidos")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Asunto")).toBeInTheDocument()
    expect(screen.getByLabelText("Mensaje")).toBeInTheDocument()
    expect(screen.getByText("Espacio que te interesa")).toBeInTheDocument()
    expect(screen.getByText("Presupuesto orientativo (opcional)")).toBeInTheDocument()
  })

  it("enlaza la casilla de privacidad con la política", () => {
    render(<ContactSection />)

    expect(screen.getByRole("link", { name: "política de privacidad" })).toHaveAttribute(
      "href",
      "/politica-privacidad"
    )
  })

  it("mantiene el honeypot fuera del alcance de una persona", () => {
    render(<ContactSection />)

    const honeypot = document.querySelector<HTMLInputElement>("#contact-website")
    expect(honeypot).not.toBeNull()
    expect(honeypot).toHaveAttribute("tabindex", "-1")
    expect(honeypot?.closest("[aria-hidden]")).not.toBeNull()
  })

  it("no envía nada y muestra los errores traducidos si el formulario está vacío", async () => {
    const user = userEvent.setup()
    render(<ContactSection />)

    await user.click(screen.getByRole("button", { name: /Solicitar información/ }))

    expect(await screen.findByText("Introduce tu nombre")).toBeInTheDocument()
    expect(screen.getByText("Escribe un asunto")).toBeInTheDocument()
    expect(screen.getByText("Debes aceptar la política de privacidad")).toBeInTheDocument()
    expect(submitLeadRequest).not.toHaveBeenCalled()
  })
})

describe("ContactSection — campos de evento corporativo", () => {
  it("los muestra solo cuando el tipo de evento lo es", async () => {
    const user = userEvent.setup()
    render(<ContactSection />)

    expect(screen.queryByLabelText("Empresa u organización")).not.toBeInTheDocument()

    await selectOption(user, "Tipo de evento", "Evento corporativo")

    expect(await screen.findByLabelText("Empresa u organización")).toBeInTheDocument()
    expect(screen.getByLabelText("Cargo (opcional)")).toBeInTheDocument()
    expect(screen.getByLabelText("Necesidades audiovisuales (opcional)")).toBeInTheDocument()
  })

  it("exige la empresa en un evento corporativo", async () => {
    const user = userEvent.setup()
    render(<ContactSection />)

    await fillRequiredFields(user, "Evento corporativo")
    await user.click(screen.getByRole("button", { name: /Solicitar información/ }))

    expect(await screen.findByText("Indica la empresa u organización")).toBeInTheDocument()
    expect(submitLeadRequest).not.toHaveBeenCalled()
  })
})

describe("ContactSection — resultado del envío", () => {
  it("anuncia el éxito en una región aria-live y le lleva el foco", async () => {
    const user = userEvent.setup()
    render(<ContactSection />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole("button", { name: /Solicitar información/ }))

    const heading = await screen.findByText("Solicitud recibida")
    const region = heading.closest("[aria-live]")
    expect(region).toHaveAttribute("aria-live", "polite")
    await waitFor(() => expect(document.activeElement).toBe(region))
  })

  it("conserva lo escrito cuando el servidor devuelve un error", async () => {
    submitLeadRequest.mockResolvedValue({ ok: false, code: "persistence-failed" })
    const user = userEvent.setup()
    render(<ContactSection />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole("button", { name: /Solicitar información/ }))

    expect(
      await screen.findByText("No hemos podido registrar tu solicitud. Escríbenos por WhatsApp o llámanos, por favor.")
    ).toBeInTheDocument()

    // Nada se ha limpiado: la persona puede reintentar sin volver a escribirlo.
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana")
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.test")
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Queremos visitar la finca.")
  })

  it("limpia el formulario tras un envío correcto", async () => {
    const user = userEvent.setup()
    render(<ContactSection />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole("button", { name: /Solicitar información/ }))

    await screen.findByText("Solicitud recibida")
    expect(screen.getByLabelText("Nombre")).toHaveValue("")
  })

  it("reutiliza la clave de idempotencia tras un error y la renueva tras un éxito", async () => {
    submitLeadRequest.mockResolvedValue({ ok: false, code: "persistence-failed" })
    const user = userEvent.setup()
    render(<ContactSection />)

    await fillRequiredFields(user)
    const submit = screen.getByRole("button", { name: /Solicitar información/ })

    await user.click(submit)
    await waitFor(() => expect(submitLeadRequest).toHaveBeenCalledTimes(1))

    await user.click(submit)
    await waitFor(() => expect(submitLeadRequest).toHaveBeenCalledTimes(2))

    const firstKey = submitLeadRequest.mock.calls[0][1].submissionId
    // Mismo intento tras un fallo: si la primera petición sí llegó a guardarse,
    // el reintento no puede crear una solicitud duplicada.
    expect(submitLeadRequest.mock.calls[1][1].submissionId).toBe(firstKey)

    // El tercer intento sale bien. Sigue siendo el mismo intento, así que sigue
    // llevando la misma clave; la renovación ocurre después del éxito.
    submitLeadRequest.mockResolvedValue({ ok: true, duplicate: false })
    await user.click(submit)
    await waitFor(() => expect(submitLeadRequest).toHaveBeenCalledTimes(3))
    expect(submitLeadRequest.mock.calls[2][1].submissionId).toBe(firstKey)

    // Una solicitud nueva, en cambio, ya viaja con una clave distinta.
    await screen.findByText("Solicitud recibida")
    await fillRequiredFields(user)
    await user.click(submit)
    await waitFor(() => expect(submitLeadRequest).toHaveBeenCalledTimes(4))

    expect(submitLeadRequest.mock.calls[3][1].submissionId).not.toBe(firstKey)
  })

  it("marca el envío como procedente de una ficha cuando llega desde su CTA", async () => {
    window.history.replaceState({}, "", "/?tipo=WEDDING&ficha=ckz0000000000000000000000")

    const user = userEvent.setup()
    render(<ContactSection />)

    // El asunto llega precargado con el texto del propio botón que se pulsó.
    expect(screen.getByLabelText("Asunto")).toHaveValue("Quiero una boda así")

    await fillRequiredFields(user, undefined, { skipSubject: true })
    await user.click(screen.getByRole("button", { name: /Solicitar información/ }))

    await waitFor(() => expect(submitLeadRequest).toHaveBeenCalled())
    const context = submitLeadRequest.mock.calls[0][1]
    expect(context.sourceForm).toBe("vip-story-cta")
    expect(context.sourceContentId).toBe("ckz0000000000000000000000")
  })
})

/** Abre un desplegable de Radix por el texto de su etiqueta y elige una opción. */
async function selectOption(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  const trigger = screen.getByText(label).parentElement?.querySelector("[role='combobox']")
  expect(trigger).not.toBeNull()

  await user.click(trigger as Element)
  await user.click(await screen.findByRole("option", { name: option }))
}

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  eventType = "Boda",
  options: { skipSubject?: boolean } = {}
) {
  await user.type(screen.getByLabelText("Nombre"), "Ana")
  await user.type(screen.getByLabelText("Apellidos"), "García")
  await user.type(screen.getByLabelText("Email"), "ana@example.test")
  if (!options.skipSubject) await user.type(screen.getByLabelText("Asunto"), "Boda en septiembre")
  await user.type(screen.getByLabelText("Mensaje"), "Queremos visitar la finca.")

  await selectOption(user, "Tipo de evento", eventType)
  await selectOption(user, "Espacio que te interesa", "Salón Portón")

  await user.click(screen.getByLabelText(/política de privacidad/))
}
