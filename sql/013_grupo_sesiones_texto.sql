-- alfredopina.ai — Backoffice SQL
-- Grupo.sesiones deja de ser un conteo (INT) para ser texto libre — Alfredo
-- lo usa para describir el calendario real ("5 Sesiones Jueves de 2 a 6 pm"),
-- no solo cuántas son. Sin datos reales que perder: INT → NVARCHAR nunca
-- pierde información, cualquier número ya guardado se conserva como texto.
-- Idempotente: si la columna ya es NVARCHAR (por si este script se corre dos
-- veces), no hace nada.

IF EXISTS (
  SELECT 1 FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('Grupo') AND c.name = 'sesiones' AND t.name = 'int'
)
  ALTER TABLE Grupo ALTER COLUMN sesiones NVARCHAR(150) NULL;
GO
