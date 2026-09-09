-- alfredopina.ai — Backoffice SQL
-- Ajustes a Solicitud (Fase 2, sesión 2026-09-09) para capturar los mismos
-- datos que ya pide el formulario público de contacto en cursos.html (fecha
-- tentativa, ciudad/sede, participantes, modalidad) — Alfredo los usa para
-- armar la Cotización después, y así el modelo ya queda alineado con lo que
-- un futuro form público (canal_origen "Sitio") va a mandar, sin tener que
-- rediseñar la tabla otra vez.
--
-- "Comentarios" del form público se guarda en la columna `notas` que ya
-- existía — no se duplica un campo de texto libre casi idéntico.
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor (preview)"
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo. Es seguro
-- volver a correrlo aunque ya se haya ejecutado parcialmente (cada paso se
-- salta solo si ya existe).

IF COL_LENGTH('Solicitud', 'fecha_tentativa') IS NULL
  ALTER TABLE Solicitud ADD fecha_tentativa NVARCHAR(200) NULL;
IF COL_LENGTH('Solicitud', 'ciudad_sede') IS NULL
  ALTER TABLE Solicitud ADD ciudad_sede NVARCHAR(150) NULL;
IF COL_LENGTH('Solicitud', 'participantes') IS NULL
  ALTER TABLE Solicitud ADD participantes NVARCHAR(50) NULL;
IF COL_LENGTH('Solicitud', 'modalidad') IS NULL
  ALTER TABLE Solicitud ADD modalidad NVARCHAR(30) NULL;
GO

-- El GO de arriba es obligatorio: dentro del MISMO batch, SQL Server no
-- reconoce todavía una columna recién agregada con ALTER TABLE — un CHECK que
-- la referencia en el mismo batch truena con "Invalid column name" aunque la
-- sintaxis esté bien (error real visto en producción el 2026-09-09). Separar
-- en su propio batch con GO lo resuelve.
--
-- En SQL Server un CHECK no rechaza NULL (evalúa a UNKNOWN, no a FALSE) — no
-- hace falta un "OR ... IS NULL" explícito para que estas dos columnas
-- opcionales sigan aceptando NULL.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Solicitud_modalidad')
  ALTER TABLE Solicitud ADD CONSTRAINT CK_Solicitud_modalidad CHECK (modalidad IN ('Online', 'Presencial', 'Híbrido'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Solicitud_participantes')
  ALTER TABLE Solicitud ADD CONSTRAINT CK_Solicitud_participantes CHECK (participantes IN ('Solo yo', '5 a 10', '10 a 15', 'Más de 15'));
