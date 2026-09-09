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
-- (o SSMS/Azure Data Studio), pega y ejecuta este script completo.

ALTER TABLE Solicitud ADD fecha_tentativa NVARCHAR(200) NULL;
ALTER TABLE Solicitud ADD ciudad_sede NVARCHAR(150) NULL;
ALTER TABLE Solicitud ADD participantes NVARCHAR(50) NULL;
ALTER TABLE Solicitud ADD modalidad NVARCHAR(30) NULL;

-- En SQL Server un CHECK no rechaza NULL (evalúa a UNKNOWN, no a FALSE) — no
-- hace falta un "OR ... IS NULL" explícito para que estas dos columnas
-- opcionales sigan aceptando NULL.
ALTER TABLE Solicitud ADD CONSTRAINT CK_Solicitud_modalidad CHECK (modalidad IN ('Online', 'Presencial', 'Híbrido'));
ALTER TABLE Solicitud ADD CONSTRAINT CK_Solicitud_participantes CHECK (participantes IN ('Solo yo', '5 a 10', '10 a 15', 'Más de 15'));
