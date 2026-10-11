/*
  035 — Cuándo y dónde se creó cada Cliente / Prospecto

  fecha_creacion = fecha y hora (UTC) del alta; origen_alta = de dónde salió: Clientes, Solicitud, Sitio, Cotización, Grupos
  o Diagnóstico. Los clientes que YA existen quedan con NULL en las dos (sql/036 los rellena con su primera interacción; el
  admin muestra "—", nunca una fecha inventada). Los nuevos se llenan solos: fecha_creacion por DEFAULT y origen_alta desde
  cada punto de alta del código. Idempotente; correrlo ANTES de desplegar.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Query editor (preview), pega y ejecuta este script completo.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cliente') AND name = 'fecha_creacion')
  ALTER TABLE Cliente ADD fecha_creacion DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cliente') AND name = 'origen_alta')
  ALTER TABLE Cliente ADD origen_alta NVARCHAR(30) NULL;
GO

-- el DEFAULT solo aplica a filas nuevas: las existentes se quedan en NULL a propósito
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Cliente_fecha_creacion')
  ALTER TABLE Cliente ADD CONSTRAINT DF_Cliente_fecha_creacion DEFAULT SYSUTCDATETIME() FOR fecha_creacion;
GO
