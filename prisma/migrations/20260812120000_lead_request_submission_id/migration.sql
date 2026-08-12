-- Clave de idempotencia de las solicitudes que llegan desde un formulario
-- público. Nullable a propósito: las solicitudes creadas fuera del formulario
-- (seed, alta manual del CRM) no tienen ninguna y varias filas pueden quedarse
-- en NULL sin chocar con el índice único (en PostgreSQL, NULL no colisiona con
-- NULL en un UNIQUE).
-- AlterTable
ALTER TABLE "lead_request" ADD COLUMN     "submissionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lead_request_submissionId_key" ON "lead_request"("submissionId");
