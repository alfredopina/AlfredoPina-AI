-- sql/012_grupo_quita_columnas.sql
-- Elimina correos_ml y pagado de Grupo — Alfredo confirmó que "Correos ML"
-- no aplica a su operación real y que "Pagado" tampoco se va a llevar en
-- este sistema. Ambas columnas nacieron con DEFAULT 0 sin nombre propio
-- (ver sql/010_grupos.sql), así que SQL Server les puso un nombre generado
-- automáticamente (algo como DF__Grupo__correos_m__xxxxxxxx) — hay que
-- encontrar y tirar esos DEFAULT constraints antes de poder tirar la
-- columna, o el ALTER TABLE...DROP COLUMN truena.
-- Idempotente y en batches separados (mismo criterio que el resto de los
-- scripts de este proyecto): seguro de volver a correr aunque ya haya
-- avanzado a medias.

DECLARE @sql NVARCHAR(MAX);

SELECT @sql = STRING_AGG(CAST('ALTER TABLE Grupo DROP CONSTRAINT ' + QUOTENAME(dc.name) + ';' AS NVARCHAR(MAX)), CHAR(10))
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('Grupo') AND c.name IN ('correos_ml', 'pagado');

IF @sql IS NOT NULL EXEC sp_executesql @sql;
GO

IF COL_LENGTH('Grupo', 'correos_ml') IS NOT NULL
  ALTER TABLE Grupo DROP COLUMN correos_ml;
GO

IF COL_LENGTH('Grupo', 'pagado') IS NOT NULL
  ALTER TABLE Grupo DROP COLUMN pagado;
GO
