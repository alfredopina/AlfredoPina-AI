-- alfredopina.ai — Backoffice SQL
-- Fase 3 Comercial (sesión 2026-09-09): agrega a Cotizacion los mismos 4
-- datos que ya capturó Solicitud en sql/007 (fecha_tentativa/ciudad_sede/
-- participantes/modalidad) — una Cotización creada desde una Solicitud
-- precarga estos campos, y una standalone los vuelve a pedir. `participantes`
-- también determina el 10% de descuento sugerido (grupos chicos: "Solo yo" o
-- "5 a 10") que calcula crearCotizacion.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo. Es seguro
-- volver a correrlo aunque ya se haya ejecutado parcialmente (cada paso se
-- salta solo si ya existe).

IF COL_LENGTH('Cotizacion', 'fecha_tentativa') IS NULL
  ALTER TABLE Cotizacion ADD fecha_tentativa NVARCHAR(200) NULL;
IF COL_LENGTH('Cotizacion', 'ciudad_sede') IS NULL
  ALTER TABLE Cotizacion ADD ciudad_sede NVARCHAR(150) NULL;
IF COL_LENGTH('Cotizacion', 'participantes') IS NULL
  ALTER TABLE Cotizacion ADD participantes NVARCHAR(50) NULL;
IF COL_LENGTH('Cotizacion', 'modalidad') IS NULL
  ALTER TABLE Cotizacion ADD modalidad NVARCHAR(30) NULL;
GO

-- GO obligatorio arriba: dentro del MISMO batch, SQL Server no reconoce
-- todavía una columna recién agregada con ALTER TABLE — un CHECK que la
-- referencia en el mismo batch truena con "Invalid column name" aunque la
-- sintaxis esté bien (mismo bug real ya visto con sql/007, ver CLAUDE.md
-- "Ya resueltos"). Separar en su propio batch con GO lo resuelve.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cotizacion_modalidad')
  ALTER TABLE Cotizacion ADD CONSTRAINT CK_Cotizacion_modalidad CHECK (modalidad IN ('Online', 'Presencial', 'Híbrido'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cotizacion_participantes')
  ALTER TABLE Cotizacion ADD CONSTRAINT CK_Cotizacion_participantes CHECK (participantes IN ('Solo yo', '5 a 10', '10 a 15', 'Más de 15'));
