/*
  024 — Nota general por grupo

  Nota de texto libre para el reporte al cliente, capturada una vez por carga
  de Calificaciones. Decisión de Alfredo: en vez de una tabla aparte solo para
  esto, se replica el mismo texto en cada fila del grupo — se lee/escribe
  igual que cualquier otra columna de Calificacion, sin JOIN extra ni otra
  tabla que mantener.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Editor de consultas,
  pega y ejecuta este script completo. Es idempotente.
*/

IF COL_LENGTH('Calificacion', 'nota_general') IS NULL
  ALTER TABLE Calificacion ADD nota_general NVARCHAR(2000) NULL;
GO
