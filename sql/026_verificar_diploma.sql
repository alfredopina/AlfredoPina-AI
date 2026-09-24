/*
  026 — Verificar diploma + "Lo que aprendió"

  1) Calificacion.aprendizaje: texto corto (2-3 renglones, uno por punto) de lo
     que aprendió el GRUPO, público en la página de verificación del diploma.
     Mismo patrón que nota_general (sql/024): se replica en cada fila del
     grupo, sin tabla aparte.
  2) Diploma.codigo_verif: código de 8 caracteres, único por diploma, que va en
     el QR (alfredopina.ai/verificar/{codigo}). No se puede adivinar, a
     diferencia del folio, que es consecutivo. Los diplomas ya emitidos lo
     reciben solos la próxima vez que se genere/actualice su grupo.

  Cómo correrlo: portal de Azure → apcweb-backoffice → Editor de consultas,
  pega y ejecuta este script completo. Es idempotente.
*/

IF COL_LENGTH('Calificacion', 'aprendizaje') IS NULL
  ALTER TABLE Calificacion ADD aprendizaje NVARCHAR(600) NULL;
GO

IF COL_LENGTH('Diploma', 'codigo_verif') IS NULL
  ALTER TABLE Diploma ADD codigo_verif NVARCHAR(8) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Diploma_codigo_verif')
  CREATE UNIQUE INDEX UX_Diploma_codigo_verif ON Diploma(codigo_verif) WHERE codigo_verif IS NOT NULL;
GO
