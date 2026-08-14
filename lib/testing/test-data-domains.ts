import { DEMO_LEAD_EMAIL_DOMAIN } from "@/lib/domain/demo"

/**
 * Dominios de correo cuyos contactos puede borrar `npm run test:clean`.
 *
 * **Vive aquí y no dentro del script por un motivo concreto:** el script llama a
 * `main()` en su nivel superior, así que importarlo desde una prueba lo *ejecuta* —y
 * lo que ejecuta es un borrado en cascada contra la base de datos. Se detectó al
 * escribir `test-data-clean.test.ts`: la primera versión importaba la constante del
 * script y, con ello, cada `npm test` habría lanzado el borrado. Con la lista en un
 * módulo sin efectos, la prueba puede vigilarla sin disparar nada.
 *
 * **La propiedad que hace segura la operación:** cada entrada pertenece a un dominio
 * que el IETF reserva y que por definición no puede existir en Internet —`.test`,
 * `.invalid` y `.example` son TLD reservados (RFC 2606 §2, RFC 6761 §6), y
 * `example.com/net/org` son los dominios de documentación de la misma norma—. Nadie
 * puede tener ahí su correo, así que ningún contacto legítimo coincide.
 *
 * `lib/testing/test-data-clean.test.ts` falla si alguien añade un dominio que sí
 * podría ser real.
 */
export const TEST_DATA_EMAIL_SUFFIXES = [
  ".test",
  ".invalid",
  ".example",
  "@example.com",
  "@example.net",
  "@example.org",
  `@${DEMO_LEAD_EMAIL_DOMAIN}`,
]
