-- Pipeline: de nueve estados a cinco fases comerciales.
--
-- Contacto, Presentación, Propuesta, Cliente y Perdida. La correspondencia va en el
-- CASE de abajo y NO es reversible: tres estados distintos caen en PRESENTATION, así
-- que revertir esta migración no puede devolver cuál era cada uno. Con la base vacía
-- (los datos de prueba se retiraron en la fase anterior) no hay nada que perder, pero
-- quede dicho para cualquier entorno con historial.
--
-- El histórico de `lead_activity` y de `audit_event` **no se reescribe**: esas dos
-- tablas son la pista de auditoría, y cambiar un registro para que diga
-- "PRESENTATION" donde en su día se anotó "CONTACTED" sería falsear lo que ocurrió.
-- Quien lee esos registros acepta los dos vocabularios (ver LEGACY_STATUS_LABEL en
-- lib/crm/labels.ts y el filtro de averageHoursToFirstContact en
-- lib/domain/metrics.ts).

CREATE TYPE "LeadRequestStatus_new" AS ENUM ('CONTACT', 'PRESENTATION', 'PROPOSAL', 'CLIENT', 'LOST');

-- El valor por defecto se retira antes de cambiar el tipo: PostgreSQL no puede
-- convertir la columna mientras su DEFAULT sea un literal del tipo antiguo.
ALTER TABLE "lead_request" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "lead_request"
  ALTER COLUMN "status" TYPE "LeadRequestStatus_new"
  USING (
    CASE "status"::text
      -- Sin trabajar todavía, y el aparcamiento de seguimiento: vuelven al principio.
      WHEN 'NEW'             THEN 'CONTACT'
      WHEN 'NURTURING'       THEN 'CONTACT'
      -- Ya se ha hablado con la persona y se le está mostrando la finca.
      WHEN 'CONTACTED'       THEN 'PRESENTATION'
      WHEN 'QUALIFIED'       THEN 'PRESENTATION'
      WHEN 'VISIT_SCHEDULED' THEN 'PRESENTATION'
      -- Presupuesto sobre la mesa, se cierre o no.
      WHEN 'PROPOSAL_SENT'   THEN 'PROPOSAL'
      WHEN 'NEGOTIATION'     THEN 'PROPOSAL'
      WHEN 'WON'             THEN 'CLIENT'
      ELSE 'LOST'
    END
  )::"LeadRequestStatus_new";

ALTER TABLE "lead_request" ALTER COLUMN "status" SET DEFAULT 'CONTACT';

DROP TYPE "LeadRequestStatus";

ALTER TYPE "LeadRequestStatus_new" RENAME TO "LeadRequestStatus";
