-- sql/016_grupo_quita_fotos_rs.sql
-- Elimina fotos_rs de Grupo — Alfredo confirmó que no lo usa ni lo va a usar
-- en este sistema (mismo criterio que correos_ml/pagado, ver sql/012).
-- Nació con DEFAULT 0 sin nombre propio (ver sql/010_grupos.sql), así que
-- SQL Server le puso un nombre generado automáticamente — hay que encontrar
-- y tirar ese DEFAULT constraint antes de poder tirar la columna, o el
-- ALTER TABLE...DROP COLUMN truena.
-- Idempotente y en batches separados (mismo criterio que el resto de los
-- scripts de este proyecto): seguro de volver a correr aunque ya haya
-- avanzado a medias.

DECLARE @sql NVARCHAR(MAX);

SELECT @sql = STRING_AGG(CAST('ALTER TABLE Grupo DROP CONSTRAINT ' + QUOTENAME(dc.name) + ';' AS NVARCHAR(MAX)), CHAR(10))
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('Grupo') AND c.name = 'fotos_rs';

IF @sql IS NOT NULL EXEC sp_executesql @sql;
GO

IF COL_LENGTH('Grupo', 'fotos_rs') IS NOT NULL
  ALTER TABLE Grupo DROP COLUMN fotos_rs;
GO
