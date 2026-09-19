-- alfredopina.ai — Backoffice SQL
-- Encuestas Fase 1: cada respuesta ahora se puede ligar a un Grupo (link por
-- grupo con token, ver api/generarLinkEncuesta) y guarda una COPIA congelada
-- de los datos del grupo y de cada pregunta al momento de contestar.
--
-- Por qué copia y no solo un JOIN a Grupo: los grupos se editan (cambia el
-- instructor, se corrige el nombre del curso) y eliminarGrupo es borrado real
-- — la encuesta debe conservar lo que era cierto cuando se aplicó. Mismo
-- criterio para la pregunta: si se edita su redacción después, el histórico no
-- debe cambiar de significado.
--
-- Solo agrega columnas NULL (no toca datos existentes, no hay ALTER COLUMN,
-- así que no hay constraints previos que revisar). Seguro de volver a correr:
-- cada ADD checa primero si la columna ya existe.
--
-- grupo_id: FK con ON DELETE SET NULL a propósito — eliminarGrupo borra de
-- verdad y no tiene cascada; sin SET NULL, borrar un Grupo con respuestas
-- fallaría por la FK. Con SET NULL las respuestas sobreviven (huérfanas de
-- grupo, pero con su copia congelada de curso/instructor/etc.).
--
-- Cómo correrlo: portal de Azure → apcweb-backoffice → "Query editor
-- (preview)", pega y ejecuta completo. Correrlo ANTES de que suba el código
-- de esta fase (enviarRespuesta ya escribe estas columnas).

IF COL_LENGTH('EncuestaRespuesta', 'grupo_id') IS NULL
  ALTER TABLE EncuestaRespuesta ADD grupo_id INT NULL;
GO
IF COL_LENGTH('EncuestaRespuesta', 'correo') IS NULL
  ALTER TABLE EncuestaRespuesta ADD correo NVARCHAR(200) NULL;
GO
IF COL_LENGTH('EncuestaRespuesta', 'herramientas') IS NULL
  ALTER TABLE EncuestaRespuesta ADD herramientas NVARCHAR(200) NULL;
GO
IF COL_LENGTH('EncuestaRespuesta', 'modalidad') IS NULL
  ALTER TABLE EncuestaRespuesta ADD modalidad NVARCHAR(30) NULL;
GO
IF COL_LENGTH('EncuestaRespuesta', 'horas') IS NULL
  ALTER TABLE EncuestaRespuesta ADD horas DECIMAL(6,1) NULL;
GO
IF COL_LENGTH('EncuestaRespuesta', 'link_generado_en') IS NULL
  ALTER TABLE EncuestaRespuesta ADD link_generado_en DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EncuestaRespuesta_Grupo')
  ALTER TABLE EncuestaRespuesta
  ADD CONSTRAINT FK_EncuestaRespuesta_Grupo FOREIGN KEY (grupo_id) REFERENCES Grupo(id) ON DELETE SET NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EncuestaRespuesta_grupo_id')
  CREATE INDEX IX_EncuestaRespuesta_grupo_id ON EncuestaRespuesta (grupo_id);
GO

-- copia congelada de la pregunta al momento de contestar (texto, categoría,
-- tipo). NULL en filas anteriores a esta fase (no hay respuestas reales aún).
IF COL_LENGTH('EncuestaRespuestaDetalle', 'pregunta_texto') IS NULL
  ALTER TABLE EncuestaRespuestaDetalle ADD pregunta_texto NVARCHAR(500) NULL;
GO
IF COL_LENGTH('EncuestaRespuestaDetalle', 'categoria') IS NULL
  ALTER TABLE EncuestaRespuestaDetalle ADD categoria NVARCHAR(60) NULL;
GO
IF COL_LENGTH('EncuestaRespuestaDetalle', 'tipo') IS NULL
  ALTER TABLE EncuestaRespuestaDetalle ADD tipo NVARCHAR(20) NULL;
GO
