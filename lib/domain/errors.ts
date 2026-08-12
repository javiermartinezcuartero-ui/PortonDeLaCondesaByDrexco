export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Transición de pipeline no permitida: ${from} -> ${to}`)
  }
}

export class DuplicateSlugError extends DomainError {
  constructor(type: string, slug: string) {
    super(`Ya existe un ContentEntry de tipo ${type} con slug "${slug}"`)
  }
}

export class MissingTranslationError extends DomainError {
  constructor(locale: string) {
    super(`Falta la traducción obligatoria "${locale}"`)
  }
}

/**
 * Otra persona (u otra pestaña) guardó la misma ficha entre la carga del
 * editor y el envío del formulario. Se detecta comparando `updatedAt`; se
 * aborta en vez de sobrescribir el trabajo ajeno.
 */
export class ConcurrentUpdateError extends DomainError {
  constructor() {
    super(
      "Otra persona ha modificado esta ficha mientras la editabas. Recarga la página para ver los cambios antes de volver a guardar."
    )
  }
}

/** La ficha no cumple los requisitos mínimos para publicarse. */
export class IncompletePublicationError extends DomainError {
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(`No se puede publicar: faltan ${missing.join(", ")}.`)
    this.missing = missing
  }
}
