-- alfredopina.ai — Backoffice SQL
-- Rediseño de Clientes (sesión 2026-09-12): Tipo de Cliente (Directo/
-- Intermediario, por ahora solo descriptivo — de cara al futuro módulo de
-- facturación, ver CLAUDE.md) y fecha_cierre real en Cotizacion (antes no
-- existía; "Días Inactivo" la necesita para calcular cuánto hace que una
-- cotización Ganada/Perdida se cerró — hasta ahora solo se aproximaba con
-- fecha_creacion en reportes, ver getResumenCotizacionesAdmin).
--
-- Idempotente (seguro de volver a correr) — mismo patrón que sql/010+.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo.

IF COL_LENGTH('Cliente', 'tipo_cliente') IS NULL
  ALTER TABLE Cliente ADD tipo_cliente NVARCHAR(20) NOT NULL CONSTRAINT DF_Cliente_tipo_cliente DEFAULT 'Directo';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cliente_tipo_cliente')
  ALTER TABLE Cliente ADD CONSTRAINT CK_Cliente_tipo_cliente CHECK (tipo_cliente IN ('Directo', 'Intermediario'));
GO

IF COL_LENGTH('Cotizacion', 'fecha_cierre') IS NULL
  ALTER TABLE Cotizacion ADD fecha_cierre DATE NULL;
GO

-- Backfill de las cotizaciones que ya estaban Ganada/Perdida antes de que
-- existiera esta columna — aproximación de una sola vez con la mejor fecha
-- que ya teníamos (fecha_envio, o fecha_creacion si nunca se marcó enviada).
-- De aquí en adelante, actualizarEstatusCotizacion la llena con la fecha real
-- del cambio de estatus, mismo criterio que ya usa con fecha_envio.
UPDATE Cotizacion
SET fecha_cierre = CAST(COALESCE(fecha_envio, fecha_creacion) AS DATE)
WHERE estatus IN ('Ganada', 'Perdida') AND fecha_cierre IS NULL;
GO
