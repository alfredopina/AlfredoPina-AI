-- alfredopina.ai — Backoffice SQL
-- Rediseño de Clientes (sesión 2026-09-12/13): Tipo de Cliente (Directo/
-- Intermediario/Indirecto — este último agregado un día después del diseño
-- original, ver CLAUDE.md — por ahora solo descriptivo, de cara al futuro
-- módulo de facturación) y fecha_cierre real en Cotizacion (antes no existía;
-- "Días Inactivo" la necesita para calcular cuánto hace que una cotización
-- Ganada/Perdida se cerró — hasta ahora solo se aproximaba con fecha_creacion
-- en reportes, ver getResumenCotizacionesAdmin).
--
-- Idempotente Y reaplicable (seguro de volver a correr, incluso si ya se
-- corrió con la lista de tipos vieja de 2 valores) — mismo patrón que
-- sql/010+, con el CHECK como excepción: se tira y se vuelve a crear siempre,
-- para poder ampliar la lista de valores permitidos sin importar si ya
-- existía.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo.

IF COL_LENGTH('Cliente', 'tipo_cliente') IS NULL
  ALTER TABLE Cliente ADD tipo_cliente NVARCHAR(20) NOT NULL CONSTRAINT DF_Cliente_tipo_cliente DEFAULT 'Directo';
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cliente_tipo_cliente')
  ALTER TABLE Cliente DROP CONSTRAINT CK_Cliente_tipo_cliente;
GO
ALTER TABLE Cliente ADD CONSTRAINT CK_Cliente_tipo_cliente CHECK (tipo_cliente IN ('Directo', 'Intermediario', 'Indirecto'));
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
