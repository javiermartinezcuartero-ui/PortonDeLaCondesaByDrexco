import { PrismaClient } from "@prisma/client"
import { E2E_DATABASE_URL } from "./accounts"

/**
 * Cliente Prisma apuntado explícitamente a la base de pruebas.
 *
 * **No se usa `@/lib/db`** a propósito: ese módulo lee `DATABASE_URL` del
 * entorno, y en el proceso de Playwright esa variable es la de la aplicación
 * (se carga `.env` para heredar las credenciales de Storage). Una prueba que
 * comprobase la base equivocada daría un verde falso o borraría lo que no debe.
 *
 * Se usa solo para *comprobar* efectos: una E2E que preparase sus datos por
 * detrás dejaría de probar el recorrido del usuario. Todo lo que las pruebas
 * crean, lo crean por la interfaz.
 */
export const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL })
