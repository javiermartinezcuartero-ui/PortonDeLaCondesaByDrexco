/**
 * Sugerencia de slug a partir de un título. Es solo una ayuda del editor: el
 * slug definitivo lo valida `slugSchema` en servidor
 * (lib/validation/content.ts), que es quien decide si es aceptable.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    // Quita los diacríticos que la descomposición NFD ha separado.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "")
}
