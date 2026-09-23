-- alfredopina.ai — Backoffice SQL
-- Diplomas, reconstruido sobre Calificaciones (ver CLAUDE.md → Roadmap /
-- Diplomas). El método de generación cambia de coordenadas fijas (pdf-lib,
-- servidor) a HTML/CSS + html2canvas + jsPDF (navegador, mismo patrón que
-- reporte-diagnostico.html/reporte-resultados.html) — ya no hace falta un
-- blob_path con el PDF pre-generado ni columnas sueltas de puntaje: el
-- diploma nace de Grupo (ya tiene herramientas/curso/fechas/instructor) +
-- Calificacion (ya tiene resultado), Diploma solo congela un snapshot de esos
-- datos al momento de generar (por eso siguen viviendo aquí como columnas
-- propias, no un JOIN en vivo — así un diploma ya emitido no cambia si luego
-- editas la calificación; para eso está anular + generar de nuevo).
--
-- grupo (texto libre) -> grupo_id (FK real). herramienta (una sola) ->
-- herramientas (JSON array, un diploma admite 1 a 3 herramientas, igual que
-- Grupo.herramientas). proyecto/asistencia/participacion/blob_path se quitan:
-- el detalle numérico ya vive en Calificacion, y ya no hay PDF pre-generado
-- que guardar (se genera al vuelo en el navegador cada vez que se abre).
--
-- diploma_token en Grupo: un link público por grupo (no por alumno) que
-- lista los diplomas vigentes de ese grupo — se genera una sola vez, la
-- primera vez que se generan diplomas de ese grupo, y se reutiliza siempre
-- (a diferencia del token de Reportes, que es nuevo en cada clic porque ahí
-- cada snapshot es inmutable; aquí el link debe reflejar anulaciones futuras).
--
-- Idempotente: cada bloque revisa si ya se aplicó antes de tocar nada.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'grupo_id')
BEGIN
  ALTER TABLE Diploma ADD grupo_id INT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Diploma_Grupo')
BEGIN
  ALTER TABLE Diploma ADD CONSTRAINT FK_Diploma_Grupo FOREIGN KEY (grupo_id) REFERENCES Grupo(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diploma_grupo_id')
  CREATE INDEX IX_Diploma_grupo_id ON Diploma(grupo_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'herramientas')
BEGIN
  ALTER TABLE Diploma ADD herramientas NVARCHAR(200) NULL; -- JSON array de slugs, ej. ["excel","powerbi"]
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'motivo_anulacion')
BEGIN
  ALTER TABLE Diploma ADD motivo_anulacion NVARCHAR(300) NULL;
END
GO

-- columnas obsoletas del método viejo — ninguna tiene DEFAULT ni depende de
-- otro constraint (se revisó sys.default_constraints antes de escribir esto)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'herramienta')
  ALTER TABLE Diploma DROP COLUMN herramienta;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'grupo')
  ALTER TABLE Diploma DROP COLUMN grupo;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'proyecto')
  ALTER TABLE Diploma DROP COLUMN proyecto;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'asistencia')
  ALTER TABLE Diploma DROP COLUMN asistencia;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'participacion')
  ALTER TABLE Diploma DROP COLUMN participacion;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Diploma') AND name = 'blob_path')
  ALTER TABLE Diploma DROP COLUMN blob_path;
GO

-- link público por grupo (no por alumno) — se llena la primera vez que se
-- generan diplomas de ese grupo, índice único filtrado porque casi siempre
-- es NULL (grupos sin diplomas generados todavía)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Grupo') AND name = 'diploma_token')
BEGIN
  ALTER TABLE Grupo ADD diploma_token NVARCHAR(64) NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Grupo_diploma_token')
  CREATE UNIQUE INDEX IX_Grupo_diploma_token ON Grupo(diploma_token) WHERE diploma_token IS NOT NULL;
GO
